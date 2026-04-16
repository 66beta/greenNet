import fs from 'fs';

const SOURCES = [
  {
    url: 'https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/reject-list.txt',
    type: 'domain-list'
  },
  {
    url: 'https://raw.githubusercontent.com/Cats-Team/AdRules/main/dns.txt',
    type: 'adblock'
  },
  {
    url: 'https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-hosts.txt',
    type: 'hosts-list'
  },
  {
    url:'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
    type:'hosts-list'
  },
  {
    url: 'https://raw.githubusercontent.com/Mice-Tailor-Infra/fcm-hosts-next/refs/heads/main/fcm_dual.hosts',
    type: 'hosts-list'
  }
];

const WHITELIST = [
  'ocloud.oppomobile.com',
  'dc.oppomobile.com',
  'push.oppomobile.com',
  'apps.oppomobile.com',
  'myoppo.com',
  'heytapmobi.com',
  'finzfin.com',
];

async function run() {
  const allDomains = new Set();

  for (const source of SOURCES) {
    try {
      console.log(`Processing ${source.type}: ${source.url}`);
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const text = await response.text();
      const lines = text.split('\n');

      for (let line of lines) {
        line = line.trim();
        // Skip metadata, comments, and CSS hiding rules
        if (!line || /^[!#\[@]/.test(line) || line.includes('##')) continue;

        let domain = '';

        if (source.type === 'domain-list') {
          domain = line.replace(/^(domain:|full:|keyword:)/, '');
        } 
        else if (source.type === 'adblock') {
          if (line.startsWith('/') && line.endsWith('/')) continue; // Skip regex
          const match = line.match(/^\|\|([a-zA-Z0-9.\-*]+)[\^/]/);
          if (match) {
            domain = match[1];
          } else if (!line.includes('|') && !line.includes('*') && line.includes('.')) {
            domain = line;
          }
        }
        else if (source.type === 'hosts-list') {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) domain = parts[1];
        }

        if (domain) {
          // Remove potential wildcards and clean the domain string
          const cleanDomain = domain.replace(/^\*\./, '').toLowerCase();
          
          // Final validation: must be a valid domain format without wildcards
          if (cleanDomain.includes('*') || !/^[a-z0-9.-]+$/.test(cleanDomain) || !cleanDomain.includes('.')) {
            continue;
          }

          // Whitelist check: Skip if domain matches or is a subdomain of whitelisted entry
          const isWhitelisted = WHITELIST.some(white => 
            cleanDomain === white || cleanDomain.endsWith(`.${white}`)
          );
          
          if (!isWhitelisted) {
            allDomains.add(cleanDomain);
          }
        }
      }
    } catch (e) {
      console.error(`Error processing ${source.url}: ${e.message}`);
    }
  }

  const output = [
    `# Generated: ${new Date().toISOString()}`,
    `# Total Unique Entries: ${allDomains.size}`,
    `# Whitelist applied: ${WHITELIST.join(', ')}`,
    ''
  ];

  // Map to both IPv4 and IPv6 for comprehensive blocking
  Array.from(allDomains).sort().forEach(domain => {
    output.push(`0.0.0.0 ${domain}`);
    output.push(`:: ${domain}`);
  });

  fs.writeFileSync('hosts', output.join('\n'));
  console.log(`Success! ${allDomains.size} domains are ready in hosts file.`);
}

run();
