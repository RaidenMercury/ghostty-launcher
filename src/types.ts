export interface Account {
  id: string;
  username: string;
  uuid: string;
  account_type: 'Offline' | 'Microsoft';
  skin_url: string | null;
  is_active: boolean;
  access_token: string | null;
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
  total_playtime_secs: number;
  last_played: string | null;
}

export interface CreateInstancePayload {
  name: string;
  mc_version: string;
  loader: string;
  memory_min_mb?: number;
  memory_max_mb?: number;
}

export interface MojangVersion {
  id: string;
  type: string;
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
}

export interface ModrinthSearchResult {
  hits: ModrinthSearchHit[];
  total_hits: number;
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
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
  is_valid: boolean;
}
