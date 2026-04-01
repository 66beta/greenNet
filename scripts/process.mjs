import fs from 'fs';

const SOURCES = [
  {
    url: 'https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/reject-list.txt',
    type: 'domain-list'
  },
  {
    url: 'https://raw.githubusercontent.com/Cats-Team/AdRules/main/dns.txt',
    type: 'adblock'
  }
];

async function run() {
  const allDomains = new Set();

  for (const source of SOURCES) {
    try {
      console.log(`Fetching ${source.type}: ${source.url}`);
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const text = await response.text();
      const lines = text.split('\n');

      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('!') || line.startsWith('[')) continue;

        let domain = '';

        if (source.type === 'domain-list') {
          // Handle domain-list (v2ray style)
          domain = line.replace(/^(domain:|full:|keyword:)/, '');
        } 
        else if (source.type === 'adblock') {
          // Handle Adblock format (ABP)
          // 1. Skip Regex rules like /^.../ as they are incompatible with hosts
          if (line.startsWith('/') && line.endsWith('/')) continue;
          
          // 2. Handle basic rules like ||example.com^
          // This captures the domain between || and ^ or /
          const match = line.match(/^\|\|([a-zA-Z0-9.\-*]+)[\^/]/);
          if (match) {
            domain = match[1];
          } else {
            continue; // Skip complex rules or hiding rules
          }
        }

        // Final cleaning
        domain = domain.replace(/^\*\./, ''); // Remove leading *. (e.g., *.example.com -> example.com)
        
        // Hosts files cannot handle wildcards like * (e.g., *-ad.byteimg.com)
        // We skip these as they would be invalid in a hosts file
        if (domain && !domain.includes('*') && !domain.includes(' ') && domain.includes('.')) {
          allDomains.add(domain.toLowerCase());
        }
      }
    } catch (e) {
      console.error(`Failed to fetch ${source.url}: ${e.message}`);
    }
  }

  const output = [
    `# Generated: ${new Date().toISOString()}`,
    `# Total Unique Domains: ${allDomains.size}`,
    '# Note: Regex and Wildcard rules from Adblock source were skipped (Incompatible with hosts)',
    ''
  ];

  Array.from(allDomains).sort().forEach(domain => {
    output.push(`0.0.0.0 ${domain}`);
    output.push(`:: ${domain}`);
  });

  fs.writeFileSync('hosts', output.join('\n'));
  console.log(`Success! Total domains indexed: ${allDomains.size}`);
}

run();
