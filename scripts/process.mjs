import axios from 'axios';
import fs from 'fs';

const SOURCES = [
  'https://raw.githubusercontent.com/Loyalsoldier/v2ray-rules-dat/release/reject-list.txt',
  'https://raw.githubusercontent.com/Cats-Team/AdRules/main/adblock.txt'
];

async function run() {
  const allDomains = new Set();

  for (const url of SOURCES) {
    try {
      const { data } = await axios.get(url);
      data.split('\n').forEach(line => {
        let d = line.trim();
        if (!d || /^[!#\[@]/.test(d)) return;
        d = d.replace(/^(domain:|full:|keyword:)/, '');
        if (d.includes(' ') || d.includes('/')) return;
        allDomains.add(d.toLowerCase());
      });
    } catch (e) {
      console.error(`Failed to fetch ${url}: ${e.message}`);
    }
  }
  
  const output = [
    `# Generated: ${new Date().toISOString()}`,
    `# Total Domains: ${allDomains.size}`,
    ''
  ];

  Array.from(allDomains).sort().forEach(domain => {
    output.push(`0.0.0.0 ${domain}`);
    output.push(`:: ${domain}`);
  });

  fs.writeFileSync('hosts', output.join('\n'));
}

run();
