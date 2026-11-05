/**
 * Guard for the hacker storyline. Everything gh0st and the Undernet crew "do" is narrative flavor:
 * made-up memos, in-world defacements, cryptic threats. Nothing here may look like a real command,
 * exploit, tool, address or personal-data pattern. Any line that trips a rule is replaced with a safe one.
 */
const RULES: [name: string, re: RegExp][] = [
  ["shell", /((^|[\s`'"(])(sudo|rm\s+-|chmod|chown|curl|wget|powershell|cmd\.exe|ssh|scp|netcat|nc\s+-|telnet|ftp|ping\s+-|apt(-get)?\s+install|pip\s+install|npm\s+i(nstall)?\s|base64)\b|\b(bash|zsh|sh|exec|eval)\s+(-\w|\/|\.\/|["'`]))/i],
  ["operators", /(\$\(|&&|\|\||\|\s*\w|;\s*\w+\s*-|>\s*\/|`[^`]*`|\$\{|%[0-9a-f]{2}|\\x[0-9a-f]{2})/i],
  ["code", /(<\s*\/?\s*(script|iframe|img|svg|object|embed)\b|javascript:|onerror\s*=|onload\s*=|function\s*\(|=>\s*\{|import\s+[\w{}*, ]+\s+from\b|import\s*\(|\bimport\s+\w+\s*;|\b\w+\.\w+\s*\(\s*["'`]|require\s*\(|document\.(cookie|write|location|body|get\w*)|window\.(location|open)|alert\s*\()/i],
  ["sql", /(\bunion\s+select\b|\bselect\s+.+\s+from\b|\bdrop\s+table\b|\binsert\s+into\b|\bdelete\s+from\b|'\s*or\s*'?\d|\bor\s+1\s*=\s*1\b|--\s*$)/i],
  ["paths", /(\/etc\/|\/bin\/|\/usr\/|\/var\/|\/tmp\/|c:\\|\\windows\\|\.\.\/|~\/\.|\.(exe|sh|bat|ps1|dll|py|php|jsp|asp)\b)/i],
  ["network", /(\b\d{1,3}(\.\d{1,3}){3}\b|\b(localhost|0\.0\.0\.0)\b|\b[a-z][\w-]*:\d{2,5}\b|https?:|www\.|\.(com|net|org|io|onion|ru|xyz)\b)/i],
  ["tools", /\b(nmap|metasploit|msf\w*|sqlmap|burp|hydra|hashcat|john\s+the|mimikatz|wireshark|aircrack|kali|parrot\s*os|cobalt\s*strike|shodan|tor\s+browser|keylogger|rootkit|botnet|payload|shellcode|exploit|cve-\d|zero[- ]?day|0day|brute[- ]?force|phishing\s+kit|ddos|dos\s+attack|sql\s*injection|xss|csrf|ransomware|malware|trojan|backdoor|privilege\s+escalation|reverse\s+shell)\b/i],
  ["secrets", /\b(password|passwd|pwd|api[_ -]?key|token|secret[_ -]?key|private[_ -]?key|ssn|social\s+security|routing\s+number|iban|cvv|pin\s+code)\s*[:=]/i],
  ["email", /[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
  ["phone", /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/],
  ["card", /\b(?:\d[ -]?){13,19}\b/],
  ["hex", /\b(0x)?[0-9a-f]{16,}\b/i],
  ["address", /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|lane|ln|boulevard|blvd)\b/i],
];

export function flavorProblems(text: string): string[] {
  // in-world @handles (e.g. @quinn.exe) are names, not files or addresses
  const t = text.replace(/(^|[\s(\["'“‘])@[\w.]+/g, "$1@user");
  return RULES.filter(([, re]) => re.test(t)).map(([n]) => n);
}
export const isFlavorSafe = (text: string) => flavorProblems(text).length === 0;
/** returns the text if it passes, otherwise the fallback (which must itself be safe) */
export const safeFlavor = (text: string, fallback: string) => (isFlavorSafe(text) ? text : fallback);
