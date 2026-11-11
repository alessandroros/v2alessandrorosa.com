/**
 * Career as a climbing route: one pitch per company, from the first one at
 * the bottom to today at the top. Grades use the UIAA scale.
 */
export interface Pitch {
  years: string;
  company: string;
  role: string;
  grade: string;
  note: string;
  gear: string[];
}

export const routeStart = 'Computer Engineering, Padova';

export const pitches: Pitch[] = [
  {
    years: 'Jan 2012 – May 2014',
    company: 'Leitner',
    role: 'Systems Engineer → SAP IT Infrastructure Manager · Sterzing',
    grade: 'IV',
    note: 'The first pitch started at a company that builds cable cars. Servers, networks and virtualization: learning to read the rock before climbing it.',
    gear: [
      'VMware ESXi',
      'Linux',
      'Windows Server',
      'SAP infrastructure',
      'Python',
      'Bash',
      'PowerShell',
    ],
  },
  {
    years: 'May 2014 – Dec 2020',
    company: 'Trilogis',
    role: 'Backend Engineer → Senior Backend Engineer · Rovereto',
    grade: 'V+',
    note: 'A long pitch, almost seven years. Enterprise APIs and integrations, identity providers, legacy systems moved to containers, and the first workloads on Azure.',
    gear: [
      '.NET',
      'Java Spring',
      'Node.js',
      'OAuth2 / OIDC',
      'Docker',
      'Azure',
    ],
  },
  {
    years: 'May 2021 – today',
    company: 'Same Deutz-Fahr',
    role: 'Software Engineer Team Lead · Rovereto',
    grade: 'VI+',
    note: 'A new route, opened from scratch: no team and no code at the start. Today the Digital Services platform manages connectivity for 10,000+ vehicles and 150 GB+ of telemetry a day, with a team of three engineers.',
    gear: [
      '.NET 8',
      'Kubernetes',
      'Kafka',
      'MQTT',
      'PostgreSQL',
      'ArgoCD',
      'OpenTelemetry',
      'IBM Cloud',
      'Angular',
    ],
  },
];
