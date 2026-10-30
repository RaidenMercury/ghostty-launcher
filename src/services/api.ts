import {
  Account,
  Instance,
  CreateInstancePayload,
  MojangManifest,
  ModrinthSearchResult,
  ModrinthVersion,
  ModFileInfo,
  SystemJavaInfo,
  JavaDownloadable,
  ModContentType,
} from '../types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invokeTauri<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<T>(cmd, args);
    } catch (e) {
      console.warn(`Tauri invoke failed for ${cmd}, falling back to web layer:`, e);
      return mockInvoke<T>(cmd, args);
    }
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

  async importModpackFile(filePath: string, customName?: string): Promise<Instance> {
    return invokeTauri<Instance>('import_modpack_file', { filePath, customName });
  },

  async installOnlineModpack(downloadUrl: string, name: string): Promise<Instance> {
    return invokeTauri<Instance>('install_online_modpack', { downloadUrl, name });
  },

  // Real-Time Mojang Manifest (All Minecraft Versions)
  async getMojangManifest(): Promise<MojangManifest> {
    try {
      const res = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      if (res.ok) {
        const data = await res.json();
        return data as MojangManifest;
      }
    } catch (e) {
      console.warn('Direct Mojang manifest fetch failed, falling back to local/Tauri:', e);
    }
    return invokeTauri<MojangManifest>('get_mojang_manifest');
  },

  async getFabricLoaders(mcVersion: string): Promise<string[]> {
    try {
      const res = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`);
      if (res.ok) {
        const data = await res.json();
        return data.map((item: any) => item.loader.version);
      }
    } catch (e) {
      console.warn('Fabric meta fetch fallback:', e);
    }
    return invokeTauri<string[]>('get_fabric_loaders', { mcVersion });
  },

  // Real-Time Modrinth Search for Mods, Modpacks, Resource Packs, Shaders
  async searchModrinth(
    query: string,
    loader?: string,
    gameVersion?: string,
    projectType: ModContentType = 'mod',
    limit: number = 24,
    offset: number = 0,
    index: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated' = 'relevance'
  ): Promise<ModrinthSearchResult> {
    try {
      // Build facets
      const facets: string[][] = [[`project_type:${projectType}`]];

      if (loader && loader !== 'all' && loader !== 'vanilla' && (projectType === 'mod' || projectType === 'modpack')) {
        facets.push([`categories:${loader.toLowerCase()}`]);
      }

      if (gameVersion && gameVersion !== 'all') {
        facets.push([`versions:${gameVersion}`]);
      }

      const params = new URLSearchParams({
        query: query.trim(),
        limit: limit.toString(),
        offset: offset.toString(),
        index: index,
        facets: JSON.stringify(facets),
      });

      const url = `https://api.modrinth.com/v2/search?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'GhosttyLauncher/0.1.0 (contact@ghostty.local)',
        },
      });

      if (res.ok) {
        const data = await res.json();
        return {
          hits: data.hits.map((h: any) => ({
            project_id: h.project_id,
            slug: h.slug,
            title: h.title,
            description: h.description,
            categories: h.categories || [],
            icon_url: h.icon_url,
            author: h.author,
            downloads: h.downloads || 0,
            follows: h.follows || 0,
            project_type: h.project_type,
            date_modified: h.date_modified,
            client_side: h.client_side,
            server_side: h.server_side,
          })),
          total_hits: data.total_hits,
          offset: data.offset,
          limit: data.limit,
        };
      }
    } catch (e) {
      console.warn('Direct Modrinth search failed, falling back to invoke:', e);
    }

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
    try {
      const params = new URLSearchParams();
      if (loader && loader !== 'vanilla' && loader !== 'all') {
        params.append('loaders', JSON.stringify([loader.toLowerCase()]));
      }
      if (gameVersion && gameVersion !== 'all') {
        params.append('game_versions', JSON.stringify([gameVersion]));
      }

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version${qs}`);
      if (res.ok) {
        const data = await res.json();
        return data as ModrinthVersion[];
      }
    } catch (e) {
      console.warn('Direct Modrinth version query fallback:', e);
    }

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
    if (isTauri) {
      return invokeTauri<string>('install_modrinth_mod', {
        instanceId,
        downloadUrl,
        filename,
      });
    }

    // In web simulation, register into instance mods
    const list = mockMods[instanceId] || [];
    const clean = filename.replace(/(\.disabled)+$/, '');
    if (!list.some((m) => m.filename.replace(/(\.disabled)+$/, '') === clean)) {
      list.unshift({
        filename: clean,
        size: Math.floor(Math.random() * 2000000 + 400000),
        enabled: true,
      });
      mockMods[instanceId] = list;
    }
    return `Simulated download of ${filename} to ${instanceId}`;
  },

  // Java Environment & Adoptium Temurin
  async detectJava(): Promise<SystemJavaInfo[]> {
    return invokeTauri<SystemJavaInfo[]>('detect_java');
  },

  async getDownloadableJavaVersions(): Promise<JavaDownloadable[]> {
    return [
      {
        version: 21,
        name: 'Eclipse Temurin 21 (LTS)',
        vendor: 'Adoptium',
        os: 'Linux x64',
        architecture: 'x64',
        download_url: 'https://github.com/adoptium/temurin21-binaries/releases/latest',
        size_mb: 48,
      },
      {
        version: 17,
        name: 'Eclipse Temurin 17 (LTS)',
        vendor: 'Adoptium',
        os: 'Linux x64',
        architecture: 'x64',
        download_url: 'https://github.com/adoptium/temurin17-binaries/releases/latest',
        size_mb: 45,
      },
      {
        version: 8,
        name: 'Eclipse Temurin 8 (LTS)',
        vendor: 'Adoptium',
        os: 'Linux x64',
        architecture: 'x64',
        download_url: 'https://github.com/adoptium/temurin8-binaries/releases/latest',
        size_mb: 42,
      },
      {
        version: 25,
        name: 'Azul Zulu OpenJDK 25 (Early Access)',
        vendor: 'Azul Systems',
        os: 'Linux x64',
        architecture: 'x64',
        download_url: 'https://www.azul.com/downloads/?package=jdk',
        size_mb: 52,
      },
    ];
  },

  async getInstanceMods(instanceId: string): Promise<ModFileInfo[]> {
    return invokeTauri<ModFileInfo[]>('get_instance_mods', { instanceId });
  },

  // FIXED Mod Toggle: Handles clean file renaming without accumulating .disabled
  async toggleInstanceMod(instanceId: string, filename: string): Promise<ModFileInfo> {
    if (isTauri) {
      await invokeTauri<boolean>('toggle_instance_mod', { instanceId, filename });
      const mods = await this.getInstanceMods(instanceId);
      const cleanTarget = filename.replace(/(\.disabled)+$/, '');
      const found = mods.find((m) => m.filename.replace(/(\.disabled)+$/, '') === cleanTarget);
      if (found) return found;
    }

    // Web simulation logic: perfectly robust
    const list = mockMods[instanceId] || [];
    const cleanTarget = filename.replace(/(\.disabled)+$/, '');
    const mod = list.find((m) => m.filename.replace(/(\.disabled)+$/, '') === cleanTarget);

    if (mod) {
      const willBeEnabled = !mod.enabled;
      mod.enabled = willBeEnabled;
      mod.filename = willBeEnabled ? cleanTarget : `${cleanTarget}.disabled`;
      return { ...mod };
    }

    // If not found, create clean state
    const isNowDisabled = !filename.endsWith('.disabled');
    const newName = isNowDisabled ? `${cleanTarget}.disabled` : cleanTarget;
    const fallbackMod: ModFileInfo = {
      filename: newName,
      size: 102400,
      enabled: !isNowDisabled,
    };
    list.push(fallbackMod);
    mockMods[instanceId] = list;
    return fallbackMod;
  },

  async launchGame(instance: Instance, username: string, uuid: string): Promise<string> {
    return invokeTauri<string>('launch_game', { instance, username, uuid });
  },
};

// Internal Mock Memory Store for browser mode
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
    java_path: '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
    jvm_args: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
    env_vars: { MESA_GL_VERSION_OVERRIDE: '4.5' },
    resolution: { width: 1920, height: 1080, fullscreen: false },
    server_auto_connect: null,
    pre_launch_command: null,
    post_exit_command: null,
    total_playtime_secs: 14200,
    last_played: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'opti-vanilla-1-20',
    name: 'Vanilla Technical Survival',
    icon: 'cube',
    mc_version: '1.20.1',
    loader: 'vanilla',
    loader_version: null,
    memory_min_mb: 2048,
    memory_max_mb: 4096,
    java_path: '/usr/lib/jvm/java-17-openjdk-amd64/bin/java',
    jvm_args: '-XX:+UseG1GC',
    env_vars: {},
    resolution: { width: 1280, height: 720, fullscreen: false },
    server_auto_connect: null,
    pre_launch_command: null,
    post_exit_command: null,
    total_playtime_secs: 7800,
    last_played: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

let mockMods: Record<string, ModFileInfo[]> = {
  'aventura-ghostty-1-21': [
    { filename: 'sodium-fabric-0.6.0-beta.2+mc1.21.jar', size: 1250320, enabled: true },
    { filename: 'lithium-fabric-0.12.0+mc1.21.jar', size: 750100, enabled: true },
    { filename: 'iris-fabric-1.7.0+mc1.21.jar', size: 3410200, enabled: true },
    { filename: 'ferritecore-fabric-6.0.3.jar.disabled', size: 210450, enabled: false },
  ],
};

async function mockInvoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 60));

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
        uuid: 'c713738d-' + Math.random().toString(16).substring(2, 6) + '-31dd-b629-3d823547a150',
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

    case 'delete_account': {
      const id = args.accountId as string;
      mockAccounts = mockAccounts.filter((a) => a.id !== id);
      if (mockAccounts.length > 0 && !mockAccounts.some((a) => a.is_active)) {
        mockAccounts[0].is_active = true;
      }
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
        loader_version: req.loader_version || null,
        memory_min_mb: req.memory_min_mb || 2048,
        memory_max_mb: req.memory_max_mb || 4096,
        java_path: req.java_path || null,
        jvm_args: req.jvm_args || '-XX:+UseG1GC',
        env_vars: {},
        resolution: { width: 1920, height: 1080, fullscreen: false },
        server_auto_connect: null,
        pre_launch_command: req.pre_launch_command || null,
        post_exit_command: null,
        total_playtime_secs: 0,
        last_played: null,
      };
      mockInstances.unshift(inst);
      return inst as unknown as T;
    }

    case 'update_instance': {
      const updated = args.instance as Instance;
      const idx = mockInstances.findIndex((i) => i.id === updated.id);
      if (idx >= 0) {
        mockInstances[idx] = updated;
      }
      return undefined as unknown as T;
    }

    case 'delete_instance': {
      const id = args.instanceId as string;
      mockInstances = mockInstances.filter((i) => i.id !== id);
      delete mockMods[id];
      return undefined as unknown as T;
    }

    case 'import_modpack_file':
    case 'install_online_modpack': {
      const name = (args.name as string) || (args.customName as string) || 'Modpack Importado';
      const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-') || `pack-${Date.now()}`;
      const inst: Instance = {
        id,
        name,
        icon: 'ghostty',
        mc_version: '1.21.4',
        loader: 'fabric',
        loader_version: '0.16.10',
        memory_min_mb: 4096,
        memory_max_mb: 6144,
        java_path: null,
        jvm_args: '-XX:+UseG1GC',
        env_vars: {},
        resolution: { width: 1920, height: 1080, fullscreen: false },
        server_auto_connect: null,
        pre_launch_command: null,
        post_exit_command: null,
        total_playtime_secs: 0,
        last_played: null,
      };
      mockInstances.unshift(inst);
      mockMods[id] = [
        { filename: 'fabric-api-0.108.0+1.21.4.jar', size: 2150000, enabled: true },
        { filename: 'sodium-fabric-0.6.0-beta.2+mc1.21.jar', size: 1250320, enabled: true },
        { filename: 'iris-fabric-1.7.0+mc1.21.jar', size: 3410200, enabled: true },
      ];
      return inst as unknown as T;
    }

    case 'detect_java':
      return [
        {
          path: '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
          version: 'OpenJDK 64-Bit Server VM (build 21.0.6+7-Debian-1)',
          major_version: 21,
          is_valid: true,
        },
        {
          path: '/usr/lib/jvm/java-17-openjdk-amd64/bin/java',
          version: 'OpenJDK 64-Bit Server VM (build 17.0.14+7-Debian-1)',
          major_version: 17,
          is_valid: true,
        },
        {
          path: '/usr/bin/java',
          version: 'OpenJDK Runtime Environment (build 21.0.6+7)',
          major_version: 21,
          is_valid: true,
        },
      ] as unknown as T;

    case 'get_instance_mods': {
      const instId = args.instanceId as string;
      return (mockMods[instId] || []) as unknown as T;
    }

    case 'launch_game': {
      const inst = args.instance as Instance;
      inst.last_played = new Date().toISOString();
      return `[SIMULACIÓN DE LANZAMIENTO OK]\nProceso JVM iniciado:\n${inst.java_path || 'java'} ${inst.jvm_args || '-XX:+UseG1GC'} -Xms${inst.memory_min_mb}M -Xmx${inst.memory_max_mb}M\nJugador: ${args.username} (UUID: ${args.uuid})\nEstancia: ${inst.name} [${inst.loader} ${inst.mc_version}]` as unknown as T;
    }

    default:
      return null as unknown as T;
  }
}
