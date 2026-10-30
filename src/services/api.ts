import {
  Account,
  Instance,
  CreateInstancePayload,
  MojangManifest,
  ModrinthSearchResult,
  ModrinthVersion,
  ModFileInfo,
  SystemJavaInfo,
} from '../types';

// Check if running inside Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invokeTauri<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  return mockInvoke<T>(cmd, args);
}

export const api = {
  // Accounts
  async getAccounts(): Promise<Account[]> {
    return invokeTauri<Account[]>('get_accounts');
  },

  async addOfflineAccount(username: string): Promise<Account> {
    return invokeTauri<Account>('add_offline_account', { username });
  },

  async setActiveAccount(accountId: string): Promise<void> {
    return invokeTauri<void>('set_active_account', { accountId });
  },

  async deleteAccount(accountId: string): Promise<void> {
    return invokeTauri<void>('delete_account', { accountId });
  },

  // Instances
  async getInstances(): Promise<Instance[]> {
    return invokeTauri<Instance[]>('get_instances');
  },

  async createInstance(request: CreateInstancePayload): Promise<Instance> {
    return invokeTauri<Instance>('create_instance', { request });
  },

  async updateInstance(instance: Instance): Promise<void> {
    return invokeTauri<void>('update_instance', { instance });
  },

  async deleteInstance(instanceId: string): Promise<void> {
    return invokeTauri<void>('delete_instance', { instanceId });
  },

  async exportInstance(instanceId: string, targetPath: string): Promise<string> {
    return invokeTauri<string>('export_instance', { instanceId, targetPath });
  },

  // Versions
  async getMojangManifest(): Promise<MojangManifest> {
    return invokeTauri<MojangManifest>('get_mojang_manifest');
  },

  async getFabricLoaders(mcVersion: string): Promise<string[]> {
    return invokeTauri<string[]>('get_fabric_loaders', { mcVersion });
  },

  // Modrinth
  async searchModrinth(
    query: string,
    loader?: string,
    gameVersion?: string,
    projectType: string = 'mod',
    limit: number = 20,
    offset: number = 0
  ): Promise<ModrinthSearchResult> {
    return invokeTauri<ModrinthSearchResult>('search_modrinth', {
      query,
      loader,
      gameVersion,
      projectType,
      limit,
      offset,
    });
  },

  async getModrinthVersions(
    projectId: string,
    loader?: string,
    gameVersion?: string
  ): Promise<ModrinthVersion[]> {
    return invokeTauri<ModrinthVersion[]>('get_modrinth_versions', {
      projectId,
      loader,
      gameVersion,
    });
  },

  async installModrinthMod(
    instanceId: string,
    downloadUrl: string,
    filename: string
  ): Promise<string> {
    return invokeTauri<string>('install_modrinth_mod', {
      instanceId,
      downloadUrl,
      filename,
    });
  },

  // Launcher & Java
  async detectJava(): Promise<SystemJavaInfo[]> {
    return invokeTauri<SystemJavaInfo[]>('detect_java');
  },

  async getInstanceMods(instanceId: string): Promise<ModFileInfo[]> {
    return invokeTauri<ModFileInfo[]>('get_instance_mods', { instanceId });
  },

  async toggleInstanceMod(instanceId: string, filename: string): Promise<boolean> {
    return invokeTauri<boolean>('toggle_instance_mod', { instanceId, filename });
  },

  async launchGame(instance: Instance, username: string, uuid: string): Promise<string> {
    return invokeTauri<string>('launch_game', { instance, username, uuid });
  },
};

// Fallback Mock data for browser / web preview testing
let mockAccounts: Account[] = [
  {
    id: 'offline_GhosttyPlayer',
    username: 'GhosttyPlayer',
    uuid: 'c713738d-4438-31dd-b629-3d823547a150',
    account_type: 'Offline',
    skin_url: null,
    is_active: true,
    access_token: null,
  },
];

let mockInstances: Instance[] = [
  {
    id: 'aventura-ghostty-1-21',
    name: 'Aventura Ghostty 1.21',
    icon: 'ghostty',
    mc_version: '1.21.4',
    loader: 'fabric',
    loader_version: '0.16.10',
    memory_min_mb: 2048,
    memory_max_mb: 8192,
    java_path: '/usr/lib/jvm/java-21-openjdk/bin/java',
    jvm_args: '-XX:+UseG1GC',
    total_playtime_secs: 14200,
    last_played: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'opti-vanilla-1-20',
    name: 'Pure Vanilla Experience',
    icon: 'cube',
    mc_version: '1.20.1',
    loader: 'vanilla',
    loader_version: null,
    memory_min_mb: 2048,
    memory_max_mb: 4096,
    java_path: null,
    jvm_args: null,
    total_playtime_secs: 7800,
    last_played: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

let mockMods: Record<string, ModFileInfo[]> = {
  'aventura-ghostty-1-21': [
    { filename: 'sodium-fabric-0.6.0-beta.2+mc1.21.jar', size: 1250320, enabled: true },
    { filename: 'lithium-fabric-0.12.0+mc1.21.jar', size: 750100, enabled: true },
    { filename: 'iris-fabric-1.7.0+mc1.21.jar', size: 3410200, enabled: true },
    { filename: 'ferritecore-fabric-6.0.3.jar', size: 210450, enabled: false },
  ],
};

async function mockInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 80));

  switch (cmd) {
    case 'get_accounts':
      return [...mockAccounts] as unknown as T;

    case 'add_offline_account': {
      const username = (args.username as string).trim();
      const id = `offline_${username}`;
      mockAccounts.forEach((a) => (a.is_active = false));
      const acc: Account = {
        id,
        username,
        uuid: 'mock-' + Math.random().toString(36).substring(2, 10),
        account_type: 'Offline',
        skin_url: null,
        is_active: true,
        access_token: null,
      };
      mockAccounts.push(acc);
      return acc as unknown as T;
    }

    case 'set_active_account': {
      const id = args.accountId as string;
      mockAccounts.forEach((a) => (a.is_active = a.id === id));
      return undefined as unknown as T;
    }

    case 'get_instances':
      return [...mockInstances] as unknown as T;

    case 'create_instance': {
      const req = args.request as CreateInstancePayload;
      const id = req.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || `inst-${Date.now()}`;
      const inst: Instance = {
        id,
        name: req.name,
        icon: 'ghostty',
        mc_version: req.mc_version,
        loader: req.loader,
        loader_version: null,
        memory_min_mb: req.memory_min_mb || 2048,
        memory_max_mb: req.memory_max_mb || 4096,
        java_path: null,
        jvm_args: null,
        total_playtime_secs: 0,
        last_played: null,
      };
      mockInstances.unshift(inst);
      return inst as unknown as T;
    }

    case 'get_mojang_manifest':
      return {
        latest: { release: '1.21.4', snapshot: '25w07a' },
        versions: [
          { id: '1.21.4', type: 'release', url: '', time: '', releaseTime: '2024-12-03' },
          { id: '1.21.1', type: 'release', url: '', time: '', releaseTime: '2024-08-08' },
          { id: '1.20.1', type: 'release', url: '', time: '', releaseTime: '2023-06-12' },
          { id: '1.19.4', type: 'release', url: '', time: '', releaseTime: '2023-03-14' },
          { id: '1.16.5', type: 'release', url: '', time: '', releaseTime: '2021-01-15' },
          { id: '1.12.2', type: 'release', url: '', time: '', releaseTime: '2017-09-18' },
        ],
      } as unknown as T;

    case 'search_modrinth': {
      const q = ((args.query as string) || '').toLowerCase();
      const mockHits: ModrinthSearchResult = {
        total_hits: 3,
        hits: [
          {
            project_id: 'AANobbMI',
            slug: 'sodium',
            title: 'Sodium',
            description: 'Modern rendering engine and client-side optimization mod for Minecraft.',
            categories: ['fabric', 'optimization'],
            icon_url: 'https://cdn.modrinth.com/data/AANobbMI/icon.png',
            author: 'jellysquid3',
            downloads: 24500000,
            follows: 135000,
            project_type: 'mod',
          },
          {
            project_id: 'gvQqBUqZ',
            slug: 'lithium',
            title: 'Lithium',
            description: 'No-compromises game physics / world ticking optimization mod for Minecraft.',
            categories: ['fabric', 'optimization'],
            icon_url: 'https://cdn.modrinth.com/data/gvQqBUqZ/icon.png',
            author: 'jellysquid3',
            downloads: 18200000,
            follows: 89000,
            project_type: 'mod',
          },
          {
            project_id: 'YL57xq9U',
            slug: 'iris',
            title: 'Iris Shaders',
            description: 'A modern shaders mod for Minecraft compatible with existing OptiFine shader packs.',
            categories: ['fabric', 'shaders'],
            icon_url: 'https://cdn.modrinth.com/data/YL57xq9U/icon.png',
            author: 'coderbot',
            downloads: 21900000,
            follows: 112000,
            project_type: 'mod',
          },
        ].filter((h) => !q || h.title.toLowerCase().includes(q) || h.description.toLowerCase().includes(q)),
      };
      return mockHits as unknown as T;
    }

    case 'detect_java':
      return [
        {
          path: '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
          version: 'openjdk version "21.0.6" 2025-01-21',
          is_valid: true,
        },
        {
          path: '/usr/lib/jvm/java-17-openjdk-amd64/bin/java',
          version: 'openjdk version "17.0.14" 2025-01-21',
          is_valid: true,
        },
      ] as unknown as T;

    case 'get_instance_mods': {
      const instId = args.instanceId as string;
      return (mockMods[instId] || []) as unknown as T;
    }

    case 'toggle_instance_mod': {
      const instId = args.instanceId as string;
      const fn = args.filename as string;
      const list = mockMods[instId] || [];
      const m = list.find((item) => item.filename === fn);
      if (m) {
        m.enabled = !m.enabled;
        return m.enabled as unknown as T;
      }
      return false as unknown as T;
    }

    case 'launch_game': {
      const inst = args.instance as Instance;
      inst.last_played = new Date().toISOString();
      return `Lanzamiento simulado exitoso para ${inst.name} en modo ${inst.loader}!` as unknown as T;
    }

    default:
      return null as unknown as T;
  }
}
