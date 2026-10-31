export type ModContentType = 'mod' | 'modpack' | 'resourcepack' | 'shader';
export type ModProvider = 'modrinth' | 'curseforge' | 'ftb';

export interface Account {
  id: string;
  username: string;
  uuid: string;
  account_type: 'Offline' | 'Microsoft' | 'ElyBy';
  skin_url: string | null;
  skin_model?: 'classic' | 'slim';
  is_active: boolean;
  access_token: string | null;
}

export interface InstanceResolution {
  width: number;
  height: number;
  fullscreen: boolean;
}

export interface InstanceServerConnect {
  host: string;
  port?: number;
}

export interface Instance {
  id: string;
  name: string;
  icon: string;
  mc_version: string;
  loader: string;
  loader_version: string | null;
  memory_min_mb: number;
  memory_max_mb: number;
  java_path: string | null;
  jvm_args: string | null;
  env_vars?: Record<string, string>;
  resolution?: InstanceResolution;
  server_auto_connect?: InstanceServerConnect | string | null;
  pre_launch_command?: string | null;
  post_exit_command?: string | null;
  play_time_minutes: number;
  last_played: string | null;
  favorite?: boolean;
  group?: string | null;
}

export interface CreateInstancePayload {
  name: string;
  mc_version: string;
  loader: string;
  loader_version?: string | null;
  icon?: string;
  memory_min_mb?: number;
  memory_max_mb?: number;
  java_path?: string;
  jvm_args?: string;
  pre_launch_command?: string;
}

export interface Cape {
  id: string;
  alias: string | null;
  url: string;
  active: boolean;
}

export interface MojangVersion {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  url: string;
  time: string;
  releaseTime: string;
}

export interface MojangManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MojangVersion[];
}

export interface ModrinthSearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  categories: string[];
  icon_url: string | null;
  author: string;
  downloads: number;
  follows: number;
  project_type: string;
  date_modified?: string;
  client_side?: string;
  server_side?: string;
  provider?: ModProvider;
  page_url?: string;
  gallery?: string[];
  license?: string;
}

export interface ModrinthSearchResult {
  hits: ModrinthSearchHit[];
  total_hits: number;
  offset: number;
  limit: number;
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  version_type?: string;
  date_published?: string;
  game_versions: string[];
  loaders: string[];
  files: {
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }[];
}

export interface ModFileInfo {
  filename: string;
  size: number;
  enabled: boolean;
}

export interface SystemJavaInfo {
  path: string;
  version: string;
  major_version: number;
  is_valid: boolean;
}

