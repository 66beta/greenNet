import fs from 'fs';

const SOURCES = [
  'https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/reject-list.txt',
  'https://raw.githubusercontent.com/Cats-Team/AdRules/main/adblock.txt'
];

async function run() {
  const allDomains = new Set();

  for (const url of SOURCES) {
    try {
      console.log(`Fetching: ${url}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.text();
      data.split('\n').forEach(line => {
        let d = line.trim();
        
        // Skip comments and invalid lines (AdGuard/v2ray prefixes)
        if (!d || /^[!#\[@]/.test(d)) return;
        
        // Clean v2ray specific prefixes
        d = d.replace(/^(domain:|full:|keyword:)/, '');
        
        // Filter out lines with spaces or paths (invalid for hosts)
        if (d.includes(' ') || d.includes('/')) return;

        allDomains.add(d.toLowerCase());
      });
    } catch (e) {
      console.error(`Failed to fetch ${url}: ${e.message}`);
    }
  }

  const output = [
    `# Generated: ${new Date().toISOString()}`,
    `# Total Unique Domains: ${allDomains.size}`,
    '# Source: Loyalsoldier reject-list & Cats-Team AdRules',
    ''
  ];

  // Map each domain to 0.0.0.0 and :: for dual-stack blocking
  Array.from(allDomains).sort().forEach(domain => {
    output.push(`0.0.0.0 ${domain}`);
    output.push(`:: ${domain}`);
  });

  fs.writeFileSync('hosts', output.join('\n'));
  console.log(`Successfully processed ${allDomains.size} domains.`);
}

run();
