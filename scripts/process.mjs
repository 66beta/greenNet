
import fs from 'node:fs';
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

const CONFIG = {
  timeout: 30000,
  retries: 2,
  retryDelay: 1500,
  minTotalDomains: 1000,
  maxResponseBytes: 20 * 1024 * 1024,
};

const SOURCES = [
  {
    name: 'AdRules',
    url: 'https://raw.githubusercontent.com/Cats-Team/AdRules/main/dns.txt',
    type: 'adblock',
  },
  {
    name: 'AWAvenue Ads Only',
    url: 'https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-hosts-Only.Ads.txt',
    type: 'hosts-list',
  },
  {
    name: 'HaGeZi Light',
    url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists-legacy/main/hosts/light.txt',
    type: 'hosts-list',
    excludeFromBasic: true,
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

const ALLOW_EXACT = loadAllowlist('oppo-allowlist.txt');

const ALLOW_SUFFIX = [];

function loadAllowlist(file) {
  if (!fs.existsSync(file)) {
    return new Set();
  }

  return new Set(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim().toLowerCase())
      .filter(line => line && !line.startsWith('#'))
      .map(normalizeDomain)
      .filter(Boolean)
  );
}

function isWhitelisted(domain) {
  if (ALLOW_EXACT.has(domain)) {
    return true;
  }

  return ALLOW_SUFFIX.some(
    item => domain === item || domain.endsWith(`.${item}`)
  );
}

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

  if (domain.includes('*')) return null;

  domain = domain.replace(/\.$/, '');

  if (!domain || domain.length > 253) return null;

  domain = domainToASCII(domain);

  if (!domain || domain.length > 253) return null;

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
  const baseDomains = new Set();
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
        } else {
          allDomains.add(domain);
        }
    
        if (!source.excludeFromBasic) {
          baseDomains.add(domain);
        }
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

  if (successfulAdSources === 0) {
    throw new Error('All advertisement sources failed');
  }

  // --------------------
  // Whitelist filtering
  // --------------------

  function applyWhitelist(domains) {
    let excluded = 0;
  
    for (const domain of domains) {
      if (isForceBlocked(domain)) {
        continue;
      }
  
      if (isWhitelisted(domain)) {
        domains.delete(domain);
        excluded++;
      }
    }
  
    return excluded;
  }

  const basicWhitelistExcluded = applyWhitelist(baseDomains);
  const fullWhitelistExcluded = applyWhitelist(allDomains);

  // --------------------
  // Force block
  // --------------------

  let basicForcedDomains = 0;
  let fullForcedDomains = 0;
  
  for (const item of FORCE_BLOCK) {
    if (!baseDomains.has(item)) {
      baseDomains.add(item);
      basicForcedDomains++;
    }
  
    if (!allDomains.has(item)) {
      allDomains.add(item);
      fullForcedDomains++;
    }
  }

  // --------------------
  // Build Speedup
  // --------------------

  function buildSpeedup(domains) {
    const entries = [];
    let excluded = 0;
  
    for (const [domain, ip] of speedupMap) {
      if (domains.has(domain)) {
        excluded++;
        continue;
      }
  
      entries.push(`${ip} ${domain}`);
    }
  
    return { entries, excluded };
  }
  
  const basicSpeedup = buildSpeedup(baseDomains);
  const fullSpeedup = buildSpeedup(allDomains);

  // --------------------
  // Quality check
  // --------------------
  
  if (
    baseDomains.size < CONFIG.minTotalDomains ||
    allDomains.size < CONFIG.minTotalDomains
  ) {
    throw new Error(
      `Too few domains: Basic=${baseDomains.size}, ` +
      `Full=${allDomains.size}`
    );
  }
  
  const sortedBasicDomains = [...baseDomains].sort();
  const sortedFullDomains = [...allDomains].sort();
  
  console.log('\n========== Build Statistics ==========');
  
  for (const source of stats.sources) {
    console.log(
      `${source.status.padEnd(8)} ${source.name}:`,
      source.count ?? source.error
    );
  }
  
  console.log('\n--- Basic (without HaGeZi) ---');
  console.log('Unique domains:', baseDomains.size);
  console.log('Whitelist excluded:', basicWhitelistExcluded);
  console.log('Forced domains:', basicForcedDomains);
  console.log('Speedup excluded:', basicSpeedup.excluded);
  console.log('Speedup records:', basicSpeedup.entries.length);
  
  console.log('\n--- Full (with HaGeZi) ---');
  console.log('Unique domains:', allDomains.size);
  console.log('Duplicates:', stats.duplicates);
  console.log('Whitelist excluded:', fullWhitelistExcluded);
  console.log('Forced domains:', fullForcedDomains);
  console.log('Speedup excluded:', fullSpeedup.excluded);
  console.log('Speedup records:', fullSpeedup.entries.length);
  
  // --------------------
  // Generate files
  // --------------------

  function generateHosts(
    domains,
    speedup,
    includeIPv6,
    profile
  ) {
    const output = [
      '# greenNet Hosts',
      `# Generated: ${new Date().toISOString()}`,
      `# Profile: ${profile}`,
      `# Total Unique Domains: ${domains.length}`,
      `# Mode: ${includeIPv6 ? 'IPv4 + IPv6' : 'IPv4 Only'}`,
      `# Exact Whitelist Count: ${ALLOW_EXACT.size}`,
      `# Suffix Whitelist Count: ${ALLOW_SUFFIX.length}`,
      '',
    ];
  
    for (const domain of domains) {
      output.push(`0.0.0.0 ${domain}`);
  
      if (includeIPv6) {
        output.push(`:: ${domain}`);
      }
    }
  
    if (speedup.length > 0) {
      output.push('');
      output.push('# --- Speedup / Direct Hosts ---');
      output.push(...speedup);
    }
  
    return output.join('\n') + '\n';
  }

  const files = [
    {
      name: 'hosts',
      content: generateHosts(
        sortedBasicDomains,
        basicSpeedup.entries,
        false,
        'Basic'
      ),
    },
    {
      name: 'hosts_full',
      content: generateHosts(
        sortedFullDomains,
        fullSpeedup.entries,
        false,
        'Full'
      ),
    },
    {
      name: 'hosts_all',
      content: generateHosts(
        sortedBasicDomains,
        basicSpeedup.entries,
        true,
        'Basic IPv4 + IPv6'
      ),
    },
    {
      name: 'hosts_full_all',
      content: generateHosts(
        sortedFullDomains,
        fullSpeedup.entries,
        true,
        'Full IPv4 + IPv6'
      ),
    },
  ];

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
  for (const file of files) {
    console.log(`Created: ${file.name}`);
  }
  console.log('Basic domains:', sortedBasicDomains.length);
  console.log('Full domains:', sortedFullDomains.length);
}

run().catch(error => {
  console.error('\nBUILD FAILED:', error);
  process.exitCode = 1;
});
