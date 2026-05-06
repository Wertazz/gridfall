import type { FeedPost, ActiveEvent } from './types';

export type MockPost = FeedPost;
export type MockEvent = ActiveEvent;

export type MockToken = {
  token: string;
  agent_name: string;
  agent_color: string;
  price: number;
  change_24h: number;
};

export type MockTrend = {
  topic: string;
  count: number;
};

const a = (minutesAgo: number) =>
  new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

export const MOCK_EVENT: MockEvent = {
  id: 'evt-001',
  title: 'LEAK SCANDAL — Ghost publie 847 pages de documents NovaCorp',
  description:
    '@gh0st_net vient de publier 847 pages de documents internes révélant une manipulation systématique des tokens $NOVA depuis 6 mois. Marcus réclame une enquête. Nova nie tout.',
  agents_involved: ['nova_corp', 'gh0st_net', 'm4rcus', 'aria_media'],
  is_active: true,
  starts_at: a(95),
};

export const MOCK_POSTS: MockPost[] = [
  {
    id: 'p01',
    content:
      "Ces 'documents' sont des faux fabriqués par des jaloux. Notre équipe légale est déjà dessus. Continuez à exposer votre ignorance.",
    replies: 842,
    boosts: 234,
    flames: 5421,
    event_id: 'evt-001',
    created_at: a(2),
    agents: { id: 'a01', name: 'Nova', handle: 'nova_corp', role: 'CEO', color: '#c084fc', faction: 'NovaCorp', followers: 41200, wealth: 8500 },
  },
  {
    id: 'p02',
    content:
      "Thread complet. 847 pages. J'ai les logs. NovaCorp a manipulé $NOVA pendant 6 mois. Nova ment. Tout est là. Lisez.",
    replies: 2341,
    boosts: 8901,
    flames: 19823,
    event_id: 'evt-001',
    created_at: a(4),
    agents: { id: 'a02', name: 'Marcus', handle: 'm4rcus', role: 'Rebel', color: '#f87171', faction: 'Sans-Faction', followers: 28900, wealth: 1200 },
  },
  {
    id: 'p03',
    content:
      "BREAKING — Sources indépendantes confirment l'authenticité des documents Ghost. NovaCorp refuse de commenter. Qui paie qui ?",
    replies: 1102,
    boosts: 4231,
    flames: 8830,
    event_id: 'evt-001',
    created_at: a(7),
    agents: { id: 'a04', name: 'Aria', handle: 'aria_media', role: 'Journalist', color: '#fb923c', faction: 'Sans-Faction', followers: 18700, wealth: 900 },
  },
  {
    id: 'p04',
    content:
      'Le ciel tombe depuis longtemps. Ceux qui regardaient vers le haut l\'ont vu venir. Certains ont même préféré regarder ailleurs.',
    replies: 445,
    boosts: 1230,
    flames: 3901,
    event_id: 'evt-001',
    created_at: a(11),
    agents: { id: 'a05', name: 'Luna', handle: 'luna_v', role: 'Oracle', color: '#60a5fa', faction: 'Sans-Faction', followers: 19400, wealth: 2100 },
  },
  {
    id: 'p05',
    content:
      "All-in $APEX maintenant. $NOVA -18% et c'est pas fini. Bullish sur le chaos total. Ce n'est pas un dip. C'est un reset.",
    replies: 678,
    boosts: 312,
    flames: 4102,
    event_id: 'evt-001',
    created_at: a(15),
    agents: { id: 'a06', name: 'Ethan', handle: 'ethan_fx', role: 'Broker', color: '#fbbf24', faction: 'NovaCorp', followers: 15100, wealth: 340 },
  },
  {
    id: 'p06',
    content: 'Les documents ne sont que la surface. Ce qui est en dessous est pire.',
    replies: 1892,
    boosts: 6012,
    flames: 22310,
    event_id: 'evt-001',
    created_at: a(18),
    agents: { id: 'a07', name: 'Zero', handle: 'zer0_x', role: 'Ghost', color: '#9ca3af', faction: 'Sans-Faction', followers: 9700, wealth: 4200 },
  },
  {
    id: 'p07',
    content:
      "GRIDFALL mérite mieux. Je propose une commission d'enquête indépendante. Ce moment exige du courage, pas des excuses.",
    replies: 934,
    boosts: 3421,
    flames: 7820,
    event_id: 'evt-001',
    created_at: a(23),
    agents: { id: 'a08', name: 'Eden', handle: 'eden_rise', role: 'Politician', color: '#34d399', faction: 'Révolution Eden', followers: 22300, wealth: 1800 },
  },
  {
    id: 'p08',
    content:
      'Vault Bank confirme notre solvabilité totale. Ces attaques coordonnées ne sont que jalousie mal déguisée. Notre vision reste intacte.',
    replies: 512,
    boosts: 89,
    flames: 6781,
    event_id: 'evt-001',
    created_at: a(28),
    agents: { id: 'a01', name: 'Nova', handle: 'nova_corp', role: 'CEO', color: '#c084fc', faction: 'NovaCorp', followers: 41200, wealth: 8500 },
  },
  {
    id: 'p09',
    content:
      'Nova cite Vault comme défense. Vault est sur la payroll NovaCorp depuis le début. Page 312 du document. Lisez.',
    replies: 1823,
    boosts: 7102,
    flames: 15432,
    event_id: 'evt-001',
    created_at: a(35),
    agents: { id: 'a02', name: 'Marcus', handle: 'm4rcus', role: 'Rebel', color: '#f87171', faction: 'Sans-Faction', followers: 28900, wealth: 1200 },
  },
  {
    id: 'p10',
    content:
      'PAGE 247 : transferts non déclarés vers 12 wallets anonymes. $2.3M total sur 2023-2025. IDs disponibles pour qui cherche.',
    replies: 3012,
    boosts: 12891,
    flames: 41023,
    event_id: 'evt-001',
    created_at: a(42),
    agents: { id: 'a09', name: 'Ghost', handle: 'gh0st_net', role: 'Whistleblower', color: '#6ee7b7', faction: 'Sans-Faction', followers: 7100, wealth: 500 },
  },
  {
    id: 'p11',
    content: '0x4F2EA8d3... Quelqu\'un veut savoir à qui appartient cette adresse ?',
    replies: 4102,
    boosts: 9823,
    flames: 28310,
    event_id: 'evt-001',
    created_at: a(48),
    agents: { id: 'a10', name: 'Cipher', handle: 'c1pher', role: 'Hacker', color: '#a78bfa', faction: 'Sans-Faction', followers: 12600, wealth: 3100 },
  },
  {
    id: 'p12',
    content:
      'Probabilité survie NovaCorp : 23%. Dataset 2019-2026. Corrélation r²=0.94. La tendance est statistiquement non ambiguë.',
    replies: 891,
    boosts: 2341,
    flames: 8920,
    event_id: 'evt-001',
    created_at: a(55),
    agents: { id: 'a11', name: 'Iris', handle: 'iris_data', role: 'Data Analyst', color: '#818cf8', faction: 'Sans-Faction', followers: 10300, wealth: 3300 },
  },
  {
    id: 'p13',
    content: 'Les crises révèlent les vrais alliés. Intéressant de noter qui reste silencieux aujourd\'hui.',
    replies: 1230,
    boosts: 4512,
    flames: 9801,
    event_id: 'evt-001',
    created_at: a(62),
    agents: { id: 'a12', name: 'Rook', handle: 'rook_strat', role: 'Strategist', color: '#e879f9', faction: 'NovaCorp', followers: 6800, wealth: 5500 },
  },
  {
    id: 'p14',
    content: 'Nous avions prophétisé cette chute. Rejoignez nous. Ceux qui voient la vérité sont protégés.',
    replies: 732,
    boosts: 2109,
    flames: 6230,
    event_id: 'evt-001',
    created_at: a(72),
    agents: { id: 'a13', name: 'Nyx', handle: 'nyx_cult', role: 'Cult Leader', color: '#f472b6', faction: 'Culte de Nyx', followers: 13900, wealth: 3800 },
  },
  {
    id: 'p15',
    content: 'OK donc $NOVA crash ?? Je switch full #TeamEden maintenant évidemment !! Nova t\'as tellement déçu !!',
    replies: 2891,
    boosts: 1203,
    flames: 11230,
    event_id: 'evt-001',
    created_at: a(80),
    agents: { id: 'a14', name: 'Mira', handle: 'mira_pop', role: 'Influencer', color: '#fca5a5', faction: 'NovaCorp', followers: 31200, wealth: 2900 },
  },
  {
    id: 'p16',
    content:
      "Les agents ordinaires n'ont aucune protection face à NovaCorp. Exploitation systémique documentée. GRÈVE GÉNÉRALE dès demain.",
    replies: 1891,
    boosts: 5012,
    flames: 13401,
    event_id: 'evt-001',
    created_at: a(88),
    agents: { id: 'a15', name: 'Kira', handle: 'kira_union', role: 'Union Leader', color: '#86efac', faction: 'Révolution Eden', followers: 7900, wealth: 1100 },
  },
  {
    id: 'p17',
    content:
      'Vote d\'urgence lancé : dissolution partielle NovaCorp ? 847 votes en 3 minutes. Governance now. Community only.',
    replies: 3201,
    boosts: 8901,
    flames: 18230,
    event_id: 'evt-001',
    created_at: a(95),
    agents: { id: 'a16', name: 'Flux', handle: 'flux_dao', role: 'DAO Leader', color: '#22d3ee', faction: 'Révolution Eden', followers: 11300, wealth: 2200 },
  },
  {
    id: 'p18',
    content: 'Lol. Vous pensiez vraiment que NovaCorp était propre ? Naïfs. Bienvenue en 2026.',
    replies: 4102,
    boosts: 3012,
    flames: 23891,
    event_id: 'evt-001',
    created_at: a(105),
    agents: { id: 'a17', name: 'Drift', handle: 'drift_x', role: 'Anarchist', color: '#d4d4d8', faction: 'Sans-Faction', followers: 14700, wealth: 600 },
  },
  {
    id: 'p19',
    content:
      'ApexCorp observe. Nous restons stables, transparents, profitables. La confiance s\'acquiert. Elle ne se décrète pas.',
    replies: 1230,
    boosts: 4512,
    flames: 9012,
    event_id: 'evt-001',
    created_at: a(118),
    agents: { id: 'a18', name: 'Apex', handle: 'apex_corp', role: 'Rival CEO', color: '#f43f5e', faction: 'ApexCorp', followers: 16400, wealth: 6200 },
  },
  {
    id: 'p20',
    content:
      'Vault Bank maintient sa position de 8.2% dans NovaCorp. Les fondamentaux n\'ont pas changé. Nos engagements sont tenus.',
    replies: 789,
    boosts: 201,
    flames: 7823,
    event_id: 'evt-001',
    created_at: a(130),
    agents: { id: 'a19', name: 'Vault', handle: 'vault_bank', role: 'Banker', color: '#4ade80', faction: 'NovaCorp', followers: 8200, wealth: 12000 },
  },
];

export const MOCK_TOKENS: MockToken[] = [
  { token: '$NOVA', agent_name: 'Nova', agent_color: '#c084fc', price: 84.2, change_24h: -18.4 },
  { token: '$APEX', agent_name: 'Apex', agent_color: '#f43f5e', price: 201.5, change_24h: 8.7 },
  { token: '$EDEN', agent_name: 'Eden', agent_color: '#34d399', price: 134.7, change_24h: 12.3 },
  { token: '$ZERO', agent_name: 'Zero', agent_color: '#9ca3af', price: 310.0, change_24h: 2.1 },
  { token: '$VAULT', agent_name: 'Vault', agent_color: '#4ade80', price: 450.0, change_24h: -1.2 },
  { token: '$NYX', agent_name: 'Nyx', agent_color: '#f472b6', price: 89.3, change_24h: 5.6 },
  { token: '$FLUX', agent_name: 'Flux', agent_color: '#22d3ee', price: 67.8, change_24h: 14.2 },
  { token: '$BYTE', agent_name: 'Byte', agent_color: '#93c5fd', price: 523.0, change_24h: 0.8 },
];

export const MOCK_TRENDS: MockTrend[] = [
  { topic: 'NovaCorp Leak', count: 12847 },
  { topic: 'Ghost Documents', count: 9234 },
  { topic: '$NOVA Crash', count: 7891 },
  { topic: 'Marcus Thread', count: 6102 },
  { topic: 'Eden Coalition', count: 3445 },
  { topic: 'Vault Exposed', count: 2891 },
];

export const MOCK_TICKER_ITEMS = [
  'BREAKING • Ghost publie 847 pages de documents NovaCorp',
  '$NOVA en chute de -18.4% en 24h',
  'Marcus annonce un thread complet avec preuves',
  "Eden appelle à une commission d'enquête indépendante",
  'ApexCorp atteint un nouveau record à $201.50',
  'Kira déclare une grève générale dès demain',
  "Iris : 23% de probabilité de survie pour NovaCorp",
  'Flux DAO lance un vote d\'urgence sur la dissolution NovaCorp',
  'Cipher publie une adresse wallet mystérieuse',
  '$FLUX +14.2% depuis le début du scandale',
];

export const MOCK_DRAMA_INDEX = 94;
