
import fs from 'node:fs';
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

const CONFIG = {
  timeout: 30000,
  retries: 2,
  retryDelay: 1500,

  // 防止上游异常返回空文件或极少量规则
  minTotalDomains: 1000,

  // 防止异常下载占用过多内存
  maxResponseBytes: 20 * 1024 * 1024,
};

const SOURCES = [
  {
    name: 'AdRules',
    url: 'https://raw.githubusercontent.com/Cats-Team/AdRules/main/dns.txt',
    type: 'adblock',
  },
  {
    name: 'AWAvenue',
    url: 'https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-hosts.txt',
    type: 'hosts-list',
  },
  {
    name: 'HaGeZi Light',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/hosts/light.txt',
    type: 'hosts-list',
  },
  {
    name: 'FCM Hosts',
    url: 'https://raw.githubusercontent.com/Mice-Tailor-Infra/fcm-hosts-next/refs/heads/main/fcm_dual.hosts',
    type: 'speedup',
  },
  {
    name: 'GitHub520',
    url: 'https://raw.githubusercontent.com/521xueweihan/GitHub520/refs/heads/main/hosts',
    type: 'speedup',
  },
];

const WHITELIST = [
  'oppomobile.com',
  'myoppo.com',
  'heytapmobi.com',
  'heytapmobile.com',
  'finzfin.com',
  'coloros.com',
];

const FORCE_BLOCK = [
  'ads.oppomobile.com',
  'ads.myoppo.com',
  'ads.heytapmobi.com',
  'ads.heytapmobile.com',
  'ads.finzfin.com',
];

const stats = {
  sources: [],
  invalidDomains: 0,
  duplicates: 0,
  whitelistExcluded: 0,
  forcedDomains: 0,
  speedupConflicts: 0,
  speedupExcluded: 0,
};

// --------------------
// Domain validation
// --------------------

function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return null;

  let domain = input.trim().toLowerCase();

  // 不接受通配符，避免改变原始规则含义
  if (domain.includes('*')) return null;

  domain = domain.replace(/\.$/, '');

  if (!domain || domain.length > 253) return null;

  // IDN 转换
  domain = domainToASCII(domain);

  if (!domain || domain.length > 253) return null;

  // Hosts 中不应出现 IP 地址
  if (isIP(domain)) return null;

  const labels = domain.split('.');

  if (labels.length < 2) return null;

  for (const label of labels) {
    if (
      label.length < 1 ||
      label.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    ) {
      return null;
    }
  }

  return domain;
}

function isWhitelisted(domain) {
  return WHITELIST.some(
    item => domain === item || domain.endsWith(`.${item}`)
  );
}

function isForceBlocked(domain) {
  return FORCE_BLOCK.some(
    item => domain === item || domain.endsWith(`.${item}`)
  );
}

// --------------------
// Download
// --------------------

async function downloadSource(source) {
  let lastError;

  for (let attempt = 0; attempt <= CONFIG.retries; attempt++) {
    try {
      const response = await fetch(source.url, {
        signal: AbortSignal.timeout(CONFIG.timeout),
        headers: {
          'User-Agent': 'greenNet-hosts-generator/2.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length === 0) {
        throw new Error('Empty response');
      }

      if (buffer.length > CONFIG.maxResponseBytes) {
        throw new Error(
          `Response too large: ${buffer.length} bytes`
        );
      }

      return buffer.toString('utf8');
    } catch (error) {
      lastError = error;

      console.error(
        `[Retry ${attempt + 1}/${CONFIG.retries + 1}]`,
        source.name,
        error.message
      );

      if (attempt < CONFIG.retries) {
        await new Promise(resolve =>
          setTimeout(resolve, CONFIG.retryDelay)
        );
      }
    }
  }

  throw lastError;
}

// --------------------
// Adblock parser
// --------------------

function parseAdblockLine(line) {
  line = line.trim();

  if (!line || line.startsWith('!') || line.startsWith('@@')) {
    return null;
  }

  // 跳过正则、CSS、例外和其他不能安全转换的规则
  if (
    line.startsWith('/') ||
    line.includes('##') ||
    line.includes('#@#') ||
    line.includes('#?#') ||
    line.includes('$')
  ) {
    return null;
  }

  // ||example.com^
  const match = line.match(/^\|\|([a-z0-9.-]+)\^$/i);

  if (match) {
    return normalizeDomain(match[1]);
  }

  // 兼容纯域名列表
  // 不再把任意包含点号的文本当成域名
  if (/^[a-z0-9.-]+$/i.test(line)) {
    return normalizeDomain(line);
  }

  return null;
}

// --------------------
// Hosts parser
// --------------------

function parseHostsLine(line) {
  line = line.trim();

  if (!line || line.startsWith('#')) return [];

  const parts = line.split(/\s+/);

  if (parts.length < 2) return [];

  if (!isIP(parts[0])) return [];

  const domains = [];

  for (const item of parts.slice(1)) {
    const domain = normalizeDomain(item);

    if (domain) {
      domains.push(domain);
    }
  }

  return domains;
}

// --------------------
// Speedup parser
// --------------------

function isUsableIP(ip) {
  const version = isIP(ip);

  if (version === 4) {
    const parts = ip.split('.').map(Number);

    // 排除未指定、回环、组播和广播地址
    if (parts[0] === 0) return false;
    if (parts[0] === 127) return false;
    if (parts[0] >= 224) return false;

    return true;
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();

    if (normalized === '::') return false;
    if (normalized === '::1') return false;
    if (normalized.startsWith('ff')) return false;

    return true;
  }

  return false;
}

function parseSpeedupLine(line) {
  line = line.trim();

  if (!line || line.startsWith('#')) return null;

  const parts = line.split(/\s+/);

  if (parts.length < 2) return null;

  const ip = parts[0];

  if (!isUsableIP(ip)) return null;

  const domains = [];

  for (const item of parts.slice(1)) {
    const domain = normalizeDomain(item);

    if (domain) {
      domains.push(domain);
    }
  }

  if (domains.length === 0) return null;

  return {
    ip,
    domains,
  };
}

// --------------------
// Source processing
// --------------------

async function processSource(source) {
  console.log(`\nProcessing: ${source.name}`);

  const content = await downloadSource(source);
  const lines = content.split(/\r?\n/);

  const domains = new Set();
  const speedup = [];

  for (const line of lines) {
    if (source.type === 'adblock') {
      const domain = parseAdblockLine(line);

      if (domain) domains.add(domain);
    }

    else if (source.type === 'hosts-list') {
      for (const domain of parseHostsLine(line)) {
        domains.add(domain);
      }
    }

    else if (source.type === 'speedup') {
      const record = parseSpeedupLine(line);

      if (record) speedup.push(record);
    }
  }

  const count = source.type === 'speedup'
    ? speedup.reduce(
        (total, record) => total + record.domains.length,
        0
      )
    : domains.size;

  if (count === 0) {
    throw new Error(
      `${source.name}: no valid entries parsed`
    );
  }

  console.log(
    `${source.name}: ${count} valid entries`
  );

  return {
    name: source.name,
    type: source.type,
    domains,
    speedup,
    count,
  };
}

// --------------------
// Build
// --------------------

async function run() {
  const allDomains = new Set();
  const speedupMap = new Map();

  let successfulAdSources = 0;

  for (const source of SOURCES) {
    try {
      const result = await processSource(source);

      stats.sources.push({
        name: result.name,
        type: result.type,
        count: result.count,
        status: 'success',
      });

      if (result.type === 'speedup') {
        for (const record of result.speedup) {
          for (const domain of record.domains) {
            const previous = speedupMap.get(domain);

            if (previous && previous !== record.ip) {
              stats.speedupConflicts++;

              console.warn(
                `[Speedup conflict] ${domain}:`,
                `${previous} vs ${record.ip}`
              );

              // 保留先出现的映射
              continue;
            }

            speedupMap.set(domain, record.ip);
          }
        }

        continue;
      }

      successfulAdSources++;

      for (const domain of result.domains) {
        if (allDomains.has(domain)) {
          stats.duplicates++;
          continue;
        }

        allDomains.add(domain);
      }
    } catch (error) {
      console.error(
        `[Source failed] ${source.name}:`,
        error.message
      );

      stats.sources.push({
        name: source.name,
        type: source.type,
        status: 'failed',
        error: error.message,
      });
    }
  }

  // 至少一个广告规则源必须成功
  if (successfulAdSources === 0) {
    throw new Error('All advertisement sources failed');
  }

  // --------------------
  // Whitelist filtering
  // --------------------

  for (const domain of allDomains) {
    if (isForceBlocked(domain)) {
      continue;
    }

    if (isWhitelisted(domain)) {
      allDomains.delete(domain);
      stats.whitelistExcluded++;
    }
  }

  // --------------------
  // Force block
  // --------------------

  for (const item of FORCE_BLOCK) {
    if (!allDomains.has(item)) {
      allDomains.add(item);
      stats.forcedDomains++;
    }
  }

  // --------------------
  // Build Speedup
  // --------------------

  const finalSpeedup = [];

  for (const [domain, ip] of speedupMap) {
    if (allDomains.has(domain)) {
      stats.speedupExcluded++;
      continue;
    }

    finalSpeedup.push(`${ip} ${domain}`);
  }

  // --------------------
  // Quality check
  // --------------------

  if (allDomains.size < CONFIG.minTotalDomains) {
    throw new Error(
      `Too few domains: ${allDomains.size}, ` +
      `minimum: ${CONFIG.minTotalDomains}`
    );
  }

  const sortedDomains = [...allDomains].sort();

  console.log('\n========== Build Statistics ==========');

  for (const source of stats.sources) {
    console.log(
      `${source.status.padEnd(8)} ${source.name}:`,
      source.count ?? source.error
    );
  }

  console.log('Unique domains:', allDomains.size);
  console.log('Duplicates:', stats.duplicates);
  console.log('Whitelist excluded:', stats.whitelistExcluded);
  console.log('Forced domains:', stats.forcedDomains);
  console.log('Speedup conflicts:', stats.speedupConflicts);
  console.log('Speedup excluded:', stats.speedupExcluded);
  console.log('Speedup records:', finalSpeedup.length);

  // --------------------
  // Generate files
  // --------------------

  function generateHosts(includeIPv6) {
    const output = [
      '# greenNet Hosts',
      `# Generated: ${new Date().toISOString()}`,
      `# Total Unique Domains: ${sortedDomains.length}`,
      `# Mode: ${includeIPv6 ? 'IPv4 + IPv6' : 'IPv4 Only'}`,
      `# Whitelist: ${WHITELIST.join(', ')}`,
      '',
    ];

    for (const domain of sortedDomains) {
      output.push(`0.0.0.0 ${domain}`);

      if (includeIPv6) {
        output.push(`:: ${domain}`);
      }
    }

    if (finalSpeedup.length > 0) {
      output.push('');
      output.push('# --- Speedup / Direct Hosts ---');
      output.push(...finalSpeedup);
    }

    return output.join('\n') + '\n';
  }

  const files = [
    {
      name: 'hosts',
      content: generateHosts(false),
    },
    {
      name: 'hosts_all',
      content: generateHosts(true),
    },
  ];

  // 先写临时文件，全部成功后再替换正式文件
  const tempFiles = files.map(file => ({
    ...file,
    temp: `${file.name}.tmp`,
  }));

  try {
    for (const file of tempFiles) {
      fs.writeFileSync(file.temp, file.content);
    }

    for (const file of tempFiles) {
      fs.renameSync(file.temp, file.name);
    }
  } catch (error) {
    for (const file of tempFiles) {
      if (fs.existsSync(file.temp)) {
        fs.unlinkSync(file.temp);
      }
    }

    throw error;
  }

  console.log('\n========== Build Success ==========');
  console.log('Created: hosts');
  console.log('Created: hosts_all');
  console.log('Total domains:', sortedDomains.length);
}

run().catch(error => {
  console.error('\nBUILD FAILED:', error);
  process.exitCode = 1;
});
