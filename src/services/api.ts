import {
  Account,
  Instance,
  CreateInstancePayload,
  MojangManifest,
  ModrinthSearchResult,
  ModrinthSearchHit,
  ModrinthVersion,
  ModFileInfo,
  SystemJavaInfo,
  Cape,
  ModContentType,
  ModProvider,
} from '../types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// El mock solo existe para `npm run dev` en el navegador. Dentro de Tauri un comando
// ausente debe fallar a la vista: el fallback silencioso convirtió el bug de Java en
// "datos" durante meses. `VITE_USE_MOCK=1` lo reactiva a propósito para demos.
const useMock = !isTauri || (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === '1');

async function invokeTauri<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!useMock) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(cmd, args);
  }
  return mockInvoke<T>(cmd, args);
}

export interface ProjectFullDetails {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  author: string;
  icon_url: string | null;
  downloads: number;
  follows: number;
  categories: string[];
  license: string;
  page_url: string;
  source_url?: string | null;
  issues_url?: string | null;
  discord_url?: string | null;
  gallery: { url: string; title?: string; description?: string }[];
  provider: ModProvider;
  project_type: string;
}

export const api = {
  async getAccounts(): Promise<Account[]> {
    return invokeTauri<Account[]>('get_accounts');
  },

  async addOfflineAccount(username: string): Promise<Account> {
    const res = await invokeTauri<Account | Account[]>('add_offline_account', { username });
    if (Array.isArray(res)) {
      return res.find((a) => a.is_active) || res[res.length - 1];
    }
    return res;
  },

  async loginElyByAccount(
    username: string,
    password: string,
    totp?: string
  ): Promise<Account> {
    const res = await invokeTauri<Account | Account[]>('login_elyby', {
      correo: username,
      contrasena: password,
      totp: totp?.trim() ? totp.trim() : null,
    });
    if (Array.isArray(res)) {
      return res.find((a) => a.is_active) || res[res.length - 1];
    }
    return res;
  },

  async iniciarOauthDispositivo(): Promise<{
    user_code: string;
    verification_uri: string;
    device_code: string;
    interval: number;
  }> {
    return invokeTauri('iniciar_oauth_dispositivo');
  },

  async esperarAutorizacionMicrosoft(
    deviceCode: string,
    interval: number
  ): Promise<Account> {
    return invokeTauri<Account>('esperar_autorizacion_microsoft', {
      deviceCode,
      interval,
    });
  },

  async loginMicrosoftAccount(identifier: string, accessToken?: string): Promise<Account> {
    const res = await invokeTauri<Account | Account[]>('login_microsoft_account', {
      identifier: accessToken?.trim() ? accessToken.trim() : identifier,
    });
    if (Array.isArray(res)) {
      return res.find((a) => a.is_active) || res[res.length - 1];
    }
    return res;
  },

  async setActiveAccount(accountId: string): Promise<void> {
    await invokeTauri<unknown>('set_active_account', { id: accountId, accountId });
  },

  async deleteAccount(accountId: string): Promise<void> {
    await invokeTauri<unknown>('remove_account', { id: accountId, accountId });
  },

  async updateAccountSkin(
    accountId: string,
    skinUrl: string | null,
    skinModel: 'classic' | 'slim' = 'classic'
  ): Promise<Account> {
    const res = await invokeTauri<Account | Account[]>('update_account_skin', {
      id: accountId,
      accountId,
      skinUrl,
      skinModel,
    });
    if (Array.isArray(res)) {
      return res.find((a) => a.id === accountId) || res[0];
    }
    return res;
  },

  async getInstances(): Promise<Instance[]> {
    return invokeTauri<Instance[]>('get_instances');
  },

  async createInstance(request: CreateInstancePayload): Promise<Instance> {
    return invokeTauri<Instance>('create_instance', {
      name: request.name,
      mcVersion: request.mc_version,
      loader: request.loader,
      loaderVersion: request.loader_version || null,
      icon: request.icon || 'minecraft',
      memoryMinMb: request.memory_min_mb ?? null,
      memoryMaxMb: request.memory_max_mb ?? null,
      jvmArgs: request.jvm_args ?? null,
      preLaunchCommand: request.pre_launch_command ?? null,
    });
  },

  async updateInstance(instance: Instance): Promise<void> {
    await invokeTauri<unknown>('update_instance', { instance });
  },

  async deleteInstance(instanceId: string): Promise<void> {
    await invokeTauri<unknown>('delete_instance', { id: instanceId, instanceId });
  },

  async importModpackFile(fileOrPath: File | string, customName?: string): Promise<Instance> {
    if (typeof File !== 'undefined' && fileOrPath instanceof File) {
      const nativePath = (fileOrPath as any).path;
      if (isTauri && nativePath) {
        return invokeTauri<Instance>('import_mrpack', {
          path: nativePath,
          filePath: nativePath,
          customName: customName || null,
        });
      }
      if (isTauri) {
        const tempPath = await invokeTauri<string>('begin_modpack_upload', {
          fileName: fileOrPath.name,
        });
        const chunkSize = 512 * 1024;
        for (let offset = 0; offset < fileOrPath.size; offset += chunkSize) {
          const slice = fileOrPath.slice(offset, offset + chunkSize);
          const sliceBuf = await slice.arrayBuffer();
          const chunkB64 = uint8ToBase64(new Uint8Array(sliceBuf));
          await invokeTauri<void>('append_modpack_chunk', {
            tempPath,
            chunkB64,
          });
        }
        return invokeTauri<Instance>('finish_modpack_upload', {
          tempPath,
          customName: customName || null,
        });
      }
      const buffer = await fileOrPath.arrayBuffer();
      return importModpackFromBuffer(buffer, fileOrPath.name, customName);
    }
    return invokeTauri<Instance>('import_mrpack', {
      path: fileOrPath,
      filePath: fileOrPath,
      customName: customName || null,
    });
  },

  async updateDiscordRpc(enabled: boolean, details: string, state: string): Promise<void> {
    await invokeTauri<void>('update_discord_rpc', { enabled, details, state });
  },

  async installOnlineModpack(downloadUrl: string, name: string, iconUrl?: string): Promise<Instance> {
    if (!isTauri && downloadUrl.startsWith('http')) {
      try {
        const res = await fetch(downloadUrl);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          return await importModpackFromBuffer(buffer, `${name}.mrpack`, name, iconUrl);
        }
      } catch (e) {
        console.warn('Direct browser .mrpack fetch fallback:', e);
      }
    }
    return invokeTauri<Instance>('install_online_modpack', { downloadUrl, name, iconUrl });
  },

  async openInstanceFolder(instanceId: string): Promise<void> {
    return invokeTauri<void>('open_instance_folder', { instanceId });
  },

  async openLauncherFolder(): Promise<void> {
    return invokeTauri<void>('open_launcher_folder');
  },

  async openExternalUrl(url: string): Promise<void> {
    if (isTauri) {
      try {
        await invokeTauri<void>('open_external_url', { url });
        return;
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },

  async getMojangManifest(): Promise<MojangManifest> {
    try {
      const res = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      if (res.ok) {
        const data = (await res.json()) as MojangManifest;
        const seen = new Set<string>();
        data.versions = (data.versions || []).filter((v) => {
          if (seen.has(v.id)) return false;
          seen.add(v.id);
          return true;
        });
        return data;
      }
    } catch (e) {
      console.warn('Direct Mojang manifest fetch failed, falling back to local/Tauri:', e);
    }
    return invokeTauri<MojangManifest>('get_mojang_versions');
  },

  async searchModrinth(
    query: string,
    loader?: string,
    gameVersion?: string,
    projectType: ModContentType = 'mod',
    limit: number = 48,
    offset: number = 0,
    index: 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated' = 'relevance',
    provider: ModProvider = 'modrinth'
  ): Promise<ModrinthSearchResult> {
    if (provider === 'ftb') {
      return searchFtbCatalog(query, loader, gameVersion, projectType, limit, offset);
    }

    try {
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
        const cfSection =
          projectType === 'modpack'
            ? 'modpacks'
            : projectType === 'resourcepack'
            ? 'texture-packs'
            : projectType === 'shader'
            ? 'shaders'
            : 'mc-mods';

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
            license: h.license,
            provider,
            page_url:
              provider === 'curseforge'
                ? `https://www.curseforge.com/minecraft/${cfSection}/${h.slug}`
                : `https://modrinth.com/${h.project_type}/${h.slug}`,
          })),
          total_hits: data.total_hits,
          offset: data.offset,
          limit: data.limit,
        };
      }
    } catch (e) {
      console.warn('Direct search failed, falling back to invoke:', e);
    }

    return invokeTauri<ModrinthSearchResult>('search_modrinth', {
      query,
      loader,
      mcVersion: gameVersion,
      gameVersion,
      projectType,
      limit,
      offset,
      index,
    });
  },

  async getProjectDetails(hit: ModrinthSearchHit): Promise<ProjectFullDetails> {
    const provider = hit.provider || 'modrinth';
    const defaultPageUrl =
      hit.page_url ||
      (provider === 'curseforge'
        ? `https://www.curseforge.com/minecraft/mc-mods/${hit.slug}`
        : provider === 'ftb'
        ? `https://www.feed-the-beast.com/modpacks/${hit.project_id.replace('ftb-', '')}`
        : `https://modrinth.com/${hit.project_type}/${hit.slug}`);

    try {
      if (!hit.project_id.startsWith('ftb-')) {
        const res = await fetch(`https://api.modrinth.com/v2/project/${hit.project_id}`);
        if (res.ok) {
          const proj = await res.json();
          return {
            project_id: hit.project_id,
            slug: proj.slug || hit.slug,
            title: proj.title || hit.title,
            description: proj.description || hit.description,
            body: proj.body || hit.description,
            author: hit.author,
            icon_url: proj.icon_url || hit.icon_url,
            downloads: proj.downloads ?? hit.downloads,
            follows: proj.followers ?? hit.follows,
            categories: proj.categories || hit.categories || [],
            license: proj.license?.id || hit.license || 'ARR',
            page_url: defaultPageUrl,
            source_url: proj.source_url,
            issues_url: proj.issues_url,
            discord_url: proj.discord_url,
            gallery: Array.isArray(proj.gallery)
              ? proj.gallery.map((g: any) => ({
                  url: g.url,
                  title: g.title,
                  description: g.description,
                }))
              : [],
            provider,
            project_type: hit.project_type,
          };
        }
      }
    } catch {}

    return {
      project_id: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      body: `${hit.description}\n\nCategorías: ${(hit.categories || []).join(', ')}`,
      author: hit.author,
      icon_url: hit.icon_url,
      downloads: hit.downloads,
      follows: hit.follows,
      categories: hit.categories || [],
      license: hit.license || 'MIT / Custom',
      page_url: defaultPageUrl,
      gallery: hit.gallery ? hit.gallery.map((u) => ({ url: u })) : [],
      provider,
      project_type: hit.project_type,
    };
  },

  async getModrinthVersions(
    projectId: string,
    loader?: string,
    gameVersion?: string
  ): Promise<ModrinthVersion[]> {
    try {
      const cleanId = projectId.replace(/^ftb-/, '');
      const params = new URLSearchParams();
      if (loader && loader !== 'vanilla' && loader !== 'all') {
        params.append('loaders', JSON.stringify([loader.toLowerCase()]));
      }
      if (gameVersion && gameVersion !== 'all') {
        params.append('game_versions', JSON.stringify([gameVersion]));
      }

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`https://api.modrinth.com/v2/project/${cleanId}/version${qs}`);
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
      mcVersion: gameVersion,
      gameVersion,
    });
  },

  async installModrinthMod(
    instanceId: string,
    downloadUrl: string,
    filename: string
  ): Promise<string> {
    if (isTauri) {
      await invokeTauri<ModFileInfo>('install_modrinth_mod', {
        instanceId,
        downloadUrl,
        filename,
      });
      return `Downloaded ${filename} to ${instanceId}`;
    }

    const list = mockMods[instanceId] || [];
    const clean = filename.replace(/(\.disabled)+$/, '');
    if (!list.some((m) => m.filename.replace(/(\.disabled)+$/, '') === clean)) {
      list.unshift({
        filename: clean,
        size: Math.floor(Math.random() * 2000000 + 400000),
        enabled: true,
      });
      mockMods[instanceId] = list;
      saveMockStore();
    }
    return `Simulated download of ${filename} to ${instanceId}`;
  },

  async exportInstance(instanceId: string, format: 'mrpack' | 'prism' | 'curseforge'): Promise<string> {
    return invokeTauri<string>('export_instance', { instanceId, format });
  },

  async getModIcons(
    instanceId: string,
    filenames: string[],
    kind: string = 'mods'
  ): Promise<Array<[string, string | null]>> {
    return invokeTauri<Array<[string, string | null]>>('get_mod_icons', {
      instanceId,
      filenames,
      kind,
    });
  },

  async duplicateInstance(id: string): Promise<Instance> {
    return invokeTauri<Instance>('duplicate_instance', { id });
  },

  async getAccountSkin(accountId: string): Promise<string | null> {
    return invokeTauri<string | null>('get_account_skin', { accountId });
  },

  async getAccountCapes(accountId: string): Promise<Cape[]> {
    return invokeTauri<Cape[]>('get_account_capes', { accountId });
  },

  async setAccountCape(accountId: string, capeId: string | null): Promise<Cape[]> {
    return invokeTauri<Cape[]>('set_account_cape', { accountId, capeId });
  },

  async detectJava(): Promise<SystemJavaInfo[]> {
    return invokeTauri<SystemJavaInfo[]>('detect_java');
  },

  async getJavaReleases(): Promise<number[]> {
    return invokeTauri<number[]>('get_java_releases');
  },

  async downloadJavaRuntime(vendor: string, majorVersion: number): Promise<SystemJavaInfo> {
    return invokeTauri<SystemJavaInfo>('download_java_runtime', { vendor, majorVersion });
  },

  async deleteInstanceMod(
    instanceId: string,
    filename: string,
    kind: string = 'mods'
  ): Promise<void> {
    if (isTauri) {
      await invokeTauri<void>('delete_instance_mod', { instanceId, filename, kind });
      return;
    }
    const list = mockMods[instanceId] || [];
    const cleanTarget = filename.replace(/(\.disabled)+$/, '');
    mockMods[instanceId] = list.filter(
      (m) => m.filename.replace(/(\.disabled)+$/, '') !== cleanTarget
    );
    saveMockStore();
  },


  async getInstanceMods(instanceId: string, kind: string = 'mods'): Promise<ModFileInfo[]> {
    return invokeTauri<ModFileInfo[]>('get_instance_mods', { instanceId, kind });
  },

  async toggleInstanceMod(
    instanceId: string,
    filename: string,
    kind: string = 'mods'
  ): Promise<ModFileInfo> {
    if (isTauri) {
      const updated = await invokeTauri<ModFileInfo>('toggle_instance_mod', {
        instanceId,
        filename,
        kind,
      });
      if (updated && updated.filename) return updated;
      const mods = await this.getInstanceMods(instanceId);
      const cleanTarget = filename.replace(/(\.disabled)+$/, '');
      const found = mods.find((m) => m.filename.replace(/(\.disabled)+$/, '') === cleanTarget);
      if (found) return found;
    }

    const list = mockMods[instanceId] || [];
    const cleanTarget = filename.replace(/(\.disabled)+$/, '');
    const mod = list.find((m) => m.filename.replace(/(\.disabled)+$/, '') === cleanTarget);

    if (mod) {
      const willBeEnabled = !mod.enabled;
      mod.enabled = willBeEnabled;
      mod.filename = willBeEnabled ? cleanTarget : `${cleanTarget}.disabled`;
      return { ...mod };
    }

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
    return invokeTauri<string>('launch_instance', {
      instanceId: instance.id,
      instance,
      username,
      uuid,
    });
  },

  async stopGame(): Promise<string> {
    return invokeTauri<string>('stop_instance');
  },
};

async function searchFtbCatalog(
  query: string,
  loader?: string,
  gameVersion?: string,
  projectType: ModContentType = 'modpack',
  limit: number = 48,
  offset: number = 0
): Promise<ModrinthSearchResult> {
  try {
    const searchQ = query.trim() ? `${query.trim()} ftb` : projectType === 'modpack' ? 'ftb' : query.trim();
    const facets: string[][] = [[`project_type:${projectType}`]];
    if (loader && loader !== 'all' && loader !== 'vanilla' && (projectType === 'mod' || projectType === 'modpack')) {
      facets.push([`categories:${loader.toLowerCase()}`]);
    }
    if (gameVersion && gameVersion !== 'all') {
      facets.push([`versions:${gameVersion}`]);
    }
    const params = new URLSearchParams({
      query: searchQ,
      limit: limit.toString(),
      offset: offset.toString(),
      index: 'downloads',
      facets: JSON.stringify(facets),
    });
    const res = await fetch(`https://api.modrinth.com/v2/search?${params.toString()}`);
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
          author: h.author || 'FTB Team',
          downloads: h.downloads || 0,
          follows: h.follows || 0,
          project_type: h.project_type,
          date_modified: h.date_modified,
          provider: 'ftb' as ModProvider,
          page_url: `https://www.feed-the-beast.com/modpacks?search=${encodeURIComponent(h.title)}`,
        })),
        total_hits: data.total_hits,
        offset: 0,
        limit,
      };
    }
  } catch {}
  return { hits: [], total_hits: 0, offset: 0, limit };
}

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
    id: 'fabulously-optimized-1-21',
    name: 'Fabulously Optimized',
    icon: 'https://cdn.modrinth.com/data/1KVo5zza/icon.png',
    mc_version: '1.21.4',
    loader: 'fabric',
    loader_version: '0.16.10',
    memory_min_mb: 2048,
    memory_max_mb: 6144,
    java_path: '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
    jvm_args: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
    env_vars: { MESA_GL_VERSION_OVERRIDE: '4.6' },
    resolution: { width: 1920, height: 1080, fullscreen: false },
    server_auto_connect: null,
    pre_launch_command: null,
    post_exit_command: null,
    play_time_minutes: 473,
    last_played: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'aventura-ghostty-1-21',
    name: 'Survival Técnico 1.21',
    icon: 'minecraft',
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
    play_time_minutes: 236,
    last_played: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'opti-vanilla-1-20',
    name: 'Vanilla Redstone Lab',
    icon: 'minecraft',
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
    play_time_minutes: 130,
    last_played: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

let mockMods: Record<string, ModFileInfo[]> = {
  'fabulously-optimized-1-21': [
    { filename: 'sodium-fabric-0.6.0+mc1.21.4.jar', size: 1320400, enabled: true },
    { filename: 'lithium-fabric-0.14.2+mc1.21.4.jar', size: 790200, enabled: true },
    { filename: 'iris-fabric-1.8.1+mc1.21.4.jar', size: 3580100, enabled: true },
    { filename: 'entityculling-fabric-1.7.2.jar', size: 420800, enabled: true },
    { filename: 'modmenu-13.0.1.jar', size: 890100, enabled: true },
  ],
  'aventura-ghostty-1-21': [
    { filename: 'sodium-fabric-0.6.0-beta.2+mc1.21.jar', size: 1250320, enabled: true },
    { filename: 'lithium-fabric-0.12.0+mc1.21.jar', size: 750100, enabled: true },
    { filename: 'iris-fabric-1.7.0+mc1.21.jar', size: 3410200, enabled: true },
    { filename: 'ferritecore-fabric-6.0.3.jar.disabled', size: 210450, enabled: false },
  ],
};

const STORAGE_ACCOUNTS_KEY = 'ghostty_accounts_v2';
const STORAGE_INSTANCES_KEY = 'ghostty_instances_v2';
const STORAGE_MODS_KEY = 'ghostty_mods_v2';

function saveMockStore() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(mockAccounts));
    localStorage.setItem(STORAGE_INSTANCES_KEY, JSON.stringify(mockInstances));
    localStorage.setItem(STORAGE_MODS_KEY, JSON.stringify(mockMods));
  } catch {}
}

function loadMockStore() {
  if (typeof localStorage === 'undefined') return;
  try {
    const rawAccs = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    if (rawAccs) {
      const parsed = JSON.parse(rawAccs);
      if (Array.isArray(parsed) && parsed.length > 0) mockAccounts = parsed;
    }
    const rawInsts = localStorage.getItem(STORAGE_INSTANCES_KEY);
    if (rawInsts) {
      const parsed = JSON.parse(rawInsts);
      if (Array.isArray(parsed) && parsed.length > 0) mockInstances = parsed;
    }
    const rawMods = localStorage.getItem(STORAGE_MODS_KEY);
    if (rawMods) {
      const parsed = JSON.parse(rawMods);
      if (parsed && typeof parsed === 'object') mockMods = { ...mockMods, ...parsed };
    }
  } catch {}
}

loadMockStore();

async function decompressZipEntry(
  bytes: Uint8Array,
  compressionMethod: number
): Promise<Uint8Array> {
  if (compressionMethod === 0) {
    return bytes;
  }
  if (compressionMethod === 8 && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes as unknown as BufferSource).catch(() => {});
    writer.close().catch(() => {});
    const res = new Response(ds.readable);
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  }
  throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function computeSha1Hex(buffer: ArrayBuffer): Promise<string | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

async function lookupModrinthIconAndMeta(
  buffer: ArrayBuffer,
  packName: string
): Promise<{ iconUrl: string | null; title?: string }> {
  const sha1 = await computeSha1Hex(buffer);
  if (sha1) {
    try {
      const verRes = await fetch(`https://api.modrinth.com/v2/version_file/${sha1}`);
      if (verRes.ok) {
        const verJson = await verRes.json();
        if (verJson?.project_id) {
          const projRes = await fetch(`https://api.modrinth.com/v2/project/${verJson.project_id}`);
          if (projRes.ok) {
            const projJson = await projRes.json();
            return {
              iconUrl: projJson.icon_url || null,
              title: projJson.title,
            };
          }
        }
      }
    } catch {}
  }

  if (packName && packName.trim().length > 2) {
    try {
      const cleanQuery = packName.replace(/\s+v?\d+(\.\d+)*.*$/i, '').trim();
      const params = new URLSearchParams({
        query: cleanQuery,
        limit: '3',
        facets: JSON.stringify([['project_type:modpack']]),
      });
      const res = await fetch(`https://api.modrinth.com/v2/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const hit = data?.hits?.[0];
        if (hit?.icon_url) {
          return { iconUrl: hit.icon_url, title: hit.title };
        }
      }
    } catch {}
  }

  return { iconUrl: null };
}

async function importModpackFromBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  customName?: string,
  providedIconUrl?: string
): Promise<Instance> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8');

  let eocdPos = -1;
  const minSearch = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }

  let modrinthIndex: any = null;
  let curseManifest: any = null;
  let embeddedIconDataUri: string | null = null;
  const zipJarMods: ModFileInfo[] = [];

  if (eocdPos >= 0) {
    const cdEntries = view.getUint16(eocdPos + 10, true);
    const cdOffset = view.getUint32(eocdPos + 16, true);
    let pos = cdOffset;

    for (let idx = 0; idx < cdEntries && pos + 46 <= bytes.length; idx++) {
      const sig = view.getUint32(pos, true);
      if (sig !== 0x02014b50) break;

      const compressionMethod = view.getUint16(pos + 10, true);
      const compressedSize = view.getUint32(pos + 20, true);
      const uncompressedSize = view.getUint32(pos + 24, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localHeaderOffset = view.getUint32(pos + 42, true);

      const entryName = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
      pos += 46 + nameLen + extraLen + commentLen;

      if (localHeaderOffset + 30 > bytes.length) continue;
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);

      const lowerName = entryName.toLowerCase();

      if (lowerName === 'modrinth.index.json') {
        try {
          const raw = await decompressZipEntry(compressedSlice, compressionMethod);
          modrinthIndex = JSON.parse(decoder.decode(raw));
        } catch (e) {
          console.warn('Error parsing modrinth.index.json:', e);
        }
      } else if (lowerName === 'manifest.json') {
        try {
          const raw = await decompressZipEntry(compressedSlice, compressionMethod);
          curseManifest = JSON.parse(decoder.decode(raw));
        } catch (e) {
          console.warn('Error parsing manifest.json:', e);
        }
      } else if (
        !embeddedIconDataUri &&
        (lowerName === 'icon.png' ||
          lowerName === 'pack.png' ||
          lowerName.endsWith('/icon.png') ||
          lowerName.endsWith('/pack.png'))
      ) {
        try {
          const raw = await decompressZipEntry(compressedSlice, compressionMethod);
          if (raw.length > 64) {
            embeddedIconDataUri = `data:image/png;base64,${uint8ToBase64(raw)}`;
          }
        } catch {}
      } else if (
        lowerName.includes('mods/') &&
        (lowerName.endsWith('.jar') || lowerName.endsWith('.jar.disabled'))
      ) {
        const cleanFile = entryName.split('/').pop() || entryName;
        zipJarMods.push({
          filename: cleanFile,
          size: uncompressedSize || compressedSize || 512000,
          enabled: !cleanFile.endsWith('.disabled'),
        });
      }
    }
  }

  const fallbackName =
    customName ||
    fileName
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.(mrpack|zip)$/i, '') ||
    'Modpack Importado';

  let packName = fallbackName;
  let mcVersion = '1.21.4';
  let loader = 'fabric';
  let loaderVersion: string | null = '0.16.10';
  const extractedMods: ModFileInfo[] = [...zipJarMods];

  if (modrinthIndex) {
    const rawTitle = (modrinthIndex.name as string)?.trim() || fallbackName;
    const verId = (modrinthIndex.versionId as string)?.trim();
    packName =
      customName ||
      (verId && !rawTitle.toLowerCase().includes(verId.toLowerCase())
        ? `${rawTitle} (${verId})`
        : rawTitle);

    const deps = modrinthIndex.dependencies || {};
    if (deps['minecraft']) {
      mcVersion = String(deps['minecraft']);
    }
    if (deps['fabric-loader']) {
      loader = 'fabric';
      loaderVersion = String(deps['fabric-loader']);
    } else if (deps['quilt-loader']) {
      loader = 'quilt';
      loaderVersion = String(deps['quilt-loader']);
    } else if (deps['neoforge']) {
      loader = 'neoforge';
      loaderVersion = String(deps['neoforge']);
    } else if (deps['forge']) {
      loader = 'forge';
      loaderVersion = String(deps['forge']);
    }

    if (Array.isArray(modrinthIndex.files)) {
      for (const f of modrinthIndex.files) {
        const p = String(f.path || '');
        const fname = p.split(/[\\/]/).pop() || p;
        if (!fname) continue;
        if (!extractedMods.some((m) => m.filename === fname)) {
          extractedMods.push({
            filename: fname,
            size: Number(f.fileSize) || 640000,
            enabled: !fname.endsWith('.disabled'),
          });
        }
      }
    }
  } else if (curseManifest) {
    const rawTitle = (curseManifest.name as string)?.trim() || fallbackName;
    const ver = (curseManifest.version as string)?.trim();
    packName =
      customName ||
      (ver && !rawTitle.toLowerCase().includes(ver.toLowerCase())
        ? `${rawTitle} (${ver})`
        : rawTitle);

    if (curseManifest.minecraft?.version) {
      mcVersion = String(curseManifest.minecraft.version);
    }
    const modLoaders = curseManifest.minecraft?.modLoaders || [];
    const primaryLoaderId = String(modLoaders[0]?.id || '').toLowerCase();
    if (primaryLoaderId.startsWith('neoforge')) {
      loader = 'neoforge';
      loaderVersion = primaryLoaderId.replace('neoforge-', '');
    } else if (primaryLoaderId.startsWith('forge')) {
      loader = 'forge';
      loaderVersion = primaryLoaderId.replace('forge-', '');
    } else if (primaryLoaderId.startsWith('fabric')) {
      loader = 'fabric';
      loaderVersion = primaryLoaderId.replace('fabric-', '');
    } else if (primaryLoaderId.startsWith('quilt')) {
      loader = 'quilt';
      loaderVersion = primaryLoaderId.replace('quilt-', '');
    }

    if (Array.isArray(curseManifest.files) && extractedMods.length === 0) {
      curseManifest.files.forEach((cf: any, i: number) => {
        extractedMods.push({
          filename: `curseforge-mod-${cf.projectID || i}-${cf.fileID || 1}.jar`,
          size: 820000,
          enabled: cf.required !== false,
        });
      });
    }
  }

  let finalIcon = providedIconUrl || embeddedIconDataUri || null;
  if (!finalIcon) {
    const lookedUp = await lookupModrinthIconAndMeta(buffer, modrinthIndex?.name || packName);
    if (lookedUp.iconUrl) {
      finalIcon = lookedUp.iconUrl;
    }
  }

  const baseSlug =
    packName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'modpack';
  const uniqueId = mockInstances.some((i) => i.id === baseSlug)
    ? `${baseSlug}-${Date.now().toString(36).slice(-4)}`
    : baseSlug;

  const newInst: Instance = {
    id: uniqueId,
    name: packName,
    icon: finalIcon || 'minecraft',
    mc_version: mcVersion,
    loader,
    loader_version: loaderVersion,
    memory_min_mb: 2048,
    memory_max_mb: 6144,
    java_path: '/usr/lib/jvm/java-21-openjdk-amd64/bin/java',
    jvm_args: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
    env_vars: {},
    resolution: { width: 1920, height: 1080, fullscreen: false },
    server_auto_connect: null,
    pre_launch_command: null,
    post_exit_command: null,
    play_time_minutes: 0,
    last_played: null,
  };

  mockInstances.unshift(newInst);
  mockMods[uniqueId] =
    extractedMods.length > 0
      ? extractedMods
      : [
          { filename: `fabric-api-${mcVersion}.jar`, size: 2150000, enabled: true },
          { filename: `sodium-${loader}-${mcVersion}.jar`, size: 1250320, enabled: true },
        ];
  saveMockStore();

  return newInst;
}

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
        skin_model: 'classic',
        is_active: true,
        access_token: null,
      };
      mockAccounts.push(acc);
      saveMockStore();
      return acc as unknown as T;
    }

    case 'login_elyby':
    case 'login_elyby_account': {
      const username = ((args.correo as string) || (args.username as string) || '').trim();
      const password = ((args.contrasena as string) || (args.password as string) || '');
      const totp = (args.totp as string) || '';

      try {
        const res = await fetch('https://authserver.ely.by/auth/authenticate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username,
            password: totp ? `${password}:${totp}` : password,
            clientToken: 'ghostty-launcher-elyby',
            requestUser: true,
            agent: { name: 'Minecraft', version: 1 },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const pName = data.selectedProfile?.name || username;
          const pId = data.selectedProfile?.id || 'e19b738d443831ddb6293d823547a150';
          const formattedUuid =
            pId.length === 32
              ? `${pId.slice(0, 8)}-${pId.slice(8, 12)}-${pId.slice(12, 16)}-${pId.slice(16, 20)}-${pId.slice(20)}`
              : pId;
          mockAccounts.forEach((a) => (a.is_active = false));
          const acc: Account = {
            id: `elyby_${formattedUuid}`,
            username: pName,
            uuid: formattedUuid,
            account_type: 'ElyBy',
            skin_url: `mc-user:${pName}`,
            skin_model: 'classic',
            is_active: true,
            access_token: data.accessToken || 'elyby_token',
          };
          mockAccounts = mockAccounts.filter((a) => a.id !== acc.id);
          mockAccounts.push(acc);
          saveMockStore();
          return acc as unknown as T;
        }
      } catch {}

      const cleanNick = username.includes('@') ? username.split('@')[0] : username;
      mockAccounts.forEach((a) => (a.is_active = false));
      const acc: Account = {
        id: `elyby_${cleanNick}`,
        username: cleanNick,
        uuid: 'e19b738d-' + Math.random().toString(16).substring(2, 6) + '-41dd-b629-3d823547a150',
        account_type: 'ElyBy',
        skin_url: `mc-user:${cleanNick}`,
        skin_model: 'classic',
        is_active: true,
        access_token: 'elyby_session_token',
      };
      mockAccounts = mockAccounts.filter((a) => a.id !== acc.id);
      mockAccounts.push(acc);
      saveMockStore();
      return acc as unknown as T;
    }

    case 'iniciar_oauth_dispositivo': {
      return {
        user_code: 'GHST-2026',
        verification_uri: 'https://www.microsoft.com/link',
        device_code: 'mock_device_code_flow',
        interval: 2,
      } as unknown as T;
    }

    case 'esperar_autorizacion_microsoft': {
      await new Promise((r) => setTimeout(r, 1800));
      mockAccounts.forEach((a) => (a.is_active = false));
      const acc: Account = {
        id: 'msa_8667ba71-b85a-4004-af54-457a9734eed7',
        username: 'StevePremium',
        uuid: '8667ba71-b85a-4004-af54-457a9734eed7',
        account_type: 'Microsoft',
        skin_url: 'mc-user:MHF_Steve',
        skin_model: 'classic',
        is_active: true,
        access_token: 'msa_device_flow_token',
      };
      mockAccounts = mockAccounts.filter((a) => a.id !== acc.id);
      mockAccounts.push(acc);
      saveMockStore();
      return acc as unknown as T;
    }

    case 'login_microsoft_account': {
      const identifier = (args.identifier as string).trim();
      const cleanName = identifier.length > 36 ? 'PlayerMSA' : identifier;
      mockAccounts.forEach((a) => (a.is_active = false));
      const acc: Account = {
        id: `msa_${cleanName}`,
        username: cleanName,
        uuid: '8667ba71-b85a-4004-af54-457a9734eed7',
        account_type: 'Microsoft',
        skin_url: `mc-user:${cleanName}`,
        skin_model: 'classic',
        is_active: true,
        access_token: 'msa_session_token',
      };
      mockAccounts = mockAccounts.filter((a) => a.id !== acc.id);
      mockAccounts.push(acc);
      saveMockStore();
      return acc as unknown as T;
    }

    case 'update_account_skin': {
      const accountId = (args.accountId as string) || (args.id as string);
      const skinUrl = (args.skinUrl as string | null) ?? null;
      const skinModel = (args.skinModel as 'classic' | 'slim') || 'classic';
      const idx = mockAccounts.findIndex((a) => a.id === accountId);
      if (idx >= 0) {
        mockAccounts[idx] = {
          ...mockAccounts[idx],
          skin_url: skinUrl,
          skin_model: skinModel,
        };
        saveMockStore();
        return { ...mockAccounts[idx] } as unknown as T;
      }
      throw new Error('Cuenta no encontrada');
    }

    case 'set_active_account': {
      const id = (args.accountId as string) || (args.id as string);
      mockAccounts.forEach((a) => (a.is_active = a.id === id));
      saveMockStore();
      return undefined as unknown as T;
    }

    case 'remove_account':
    case 'delete_account': {
      const id = (args.accountId as string) || (args.id as string);
      mockAccounts = mockAccounts.filter((a) => a.id !== id);
      if (mockAccounts.length > 0 && !mockAccounts.some((a) => a.is_active)) {
        mockAccounts[0].is_active = true;
      }
      saveMockStore();
      return undefined as unknown as T;
    }

    case 'get_instances':
      return [...mockInstances] as unknown as T;

    case 'create_instance': {
      const req = (args.request as CreateInstancePayload) || {
        name: args.name as string,
        mc_version: args.mcVersion as string,
        loader: args.loader as string,
        loader_version: (args.loaderVersion as string) || null,
        icon: (args.icon as string) || 'minecraft',
      };
      const baseId = req.name.toLowerCase().replace(/[^a-z0-9]/g, '-') || `inst-${Date.now()}`;
      const id = mockInstances.some((i) => i.id === baseId)
        ? `${baseId}-${Date.now().toString(36).slice(-4)}`
        : baseId;
      const inst: Instance = {
        id,
        name: req.name,
        icon: req.icon || 'minecraft',
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
        play_time_minutes: 0,
        last_played: null,
      };
      mockInstances.unshift(inst);
      saveMockStore();
      return inst as unknown as T;
    }

    case 'update_instance': {
      const updated = args.instance as Instance;
      const idx = mockInstances.findIndex((i) => i.id === updated.id);
      if (idx >= 0) {
        mockInstances[idx] = updated;
        saveMockStore();
      }
      return undefined as unknown as T;
    }

    case 'delete_instance': {
      const id = (args.instanceId as string) || (args.id as string);
      mockInstances = mockInstances.filter((i) => i.id !== id);
      delete mockMods[id];
      saveMockStore();
      return undefined as unknown as T;
    }

    case 'import_mrpack':
    case 'import_modpack_file':
    case 'install_online_modpack': {
      const rawPath = (args.filePath as string) || (args.path as string) || '';
      const fallbackFromPath = rawPath
        .split(/[\\/]/)
        .pop()
        ?.replace(/\.(mrpack|zip)$/i, '');
      const name =
        (args.name as string) ||
        (args.customName as string) ||
        fallbackFromPath ||
        'Modpack Importado';
      let icon = (args.iconUrl as string) || (args.icon as string) || '';

      if (!icon || icon === 'ghostty' || icon === 'minecraft') {
        const looked = await lookupModrinthIconAndMeta(new ArrayBuffer(0), name);
        icon = looked.iconUrl || 'minecraft';
      }

      const baseId = name.toLowerCase().replace(/[^a-z0-9]/g, '-') || `pack-${Date.now()}`;
      const id = mockInstances.some((i) => i.id === baseId)
        ? `${baseId}-${Date.now().toString(36).slice(-4)}`
        : baseId;
      const inst: Instance = {
        id,
        name,
        icon,
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
        play_time_minutes: 0,
        last_played: null,
      };
      mockInstances.unshift(inst);
      mockMods[id] = [
        { filename: 'fabric-api-0.108.0+1.21.4.jar', size: 2150000, enabled: true },
        { filename: 'sodium-fabric-0.6.0-beta.2+mc1.21.jar', size: 1250320, enabled: true },
        { filename: 'iris-fabric-1.7.0+mc1.21.jar', size: 3410200, enabled: true },
      ];
      saveMockStore();
      return inst as unknown as T;
    }

    case 'open_instance_folder':
    case 'open_launcher_folder':
    case 'open_external_url':
    case 'update_discord_rpc':
      return undefined as unknown as T;

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

    case 'launch_instance':
    case 'launch_game': {
      const inst = args.instance as Instance;
      if (inst) {
        inst.last_played = new Date().toISOString();
      }
      return `[SIMULACIÓN DE LANZAMIENTO OK]\nProceso JVM iniciado:\n${inst?.java_path || 'java'} ${inst?.jvm_args || '-XX:+UseG1GC'} -Xms${inst?.memory_min_mb ?? 2048}M -Xmx${inst?.memory_max_mb ?? 4096}M\nJugador: ${args.username} (UUID: ${args.uuid})\nEstancia: ${inst?.name} [${inst?.loader} ${inst?.mc_version}]` as unknown as T;
    }

    case 'stop_instance':
      return 'Proceso de Minecraft detenido.' as unknown as T;

    default:
      return null as unknown as T;
  }
}
