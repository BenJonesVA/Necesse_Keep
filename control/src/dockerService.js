const Docker = require("dockerode");
const envFile = require("./envFile");

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const CONTAINER_NAME = process.env.NECESSE_CONTAINER_NAME || "necesse-server";

function getContainer() {
  return docker.getContainer(CONTAINER_NAME);
}

async function getStatus() {
  const container = getContainer();
  let info;
  try {
    info = await container.inspect();
  } catch (err) {
    if (err.statusCode === 404) {
      return { exists: false, running: false };
    }
    throw err;
  }

  const running = info.State.Running;
  const result = {
    exists: true,
    running,
    startedAt: running ? info.State.StartedAt : null,
    exitCode: running ? null : info.State.ExitCode,
  };

  if (running) {
    const stats = await container.stats({ stream: false });
    result.cpuPercent = computeCpuPercent(stats);
    result.memUsageBytes = stats.memory_stats.usage || 0;
    result.memLimitBytes = stats.memory_stats.limit || 0;
  }

  return result;
}

function computeCpuPercent(stats) {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount =
    stats.cpu_stats.online_cpus || (stats.cpu_stats.cpu_usage.percpu_usage || [1]).length;
  if (systemDelta > 0 && cpuDelta > 0) {
    return (cpuDelta / systemDelta) * cpuCount * 100;
  }
  return 0;
}

async function start() {
  const container = getContainer();
  const info = await container.inspect();
  if (!info.State.Running) await container.start();
}

async function stop() {
  const container = getContainer();
  const info = await container.inspect();
  if (info.State.Running) await container.stop({ t: 15 });
}

async function restart() {
  await getContainer().restart({ t: 15 });
}

// Rebuilds the necesse-server container from scratch so new env vars take
// effect. Env is built ENTIRELY from the persisted .env file (never from the
// currently-running container's Config.Env) so the on-disk config, the live
// container, and a future manual `docker compose up -d` never drift apart.
// HostConfig (Binds, RestartPolicy, etc.) IS cloned from the running
// container via inspect, purely to avoid re-resolving bind-mount host paths
// ourselves (a real risk cross-platform) -- not to source config values.
async function recreateNecesseContainer() {
  const container = getContainer();
  const info = await container.inspect();
  const wasRunning = info.State.Running;

  const env = envFile.readAll();
  const containerEnv = [
    `WORLD=${env.WORLD ?? "world"}`,
    `SLOTS=${env.SLOTS ?? "10"}`,
    `OWNER=${env.OWNER ?? ""}`,
    `MOTD=${env.MOTD ?? "This server is made possible by Docker!"}`,
    `PASSWORD=${env.PASSWORD ?? ""}`,
    `PAUSE=${env.PAUSE ?? "0"}`,
    `GIVE_CLIENTS_POWER=${env.GIVE_CLIENTS_POWER ?? "1"}`,
    `LOGGING=${env.LOGGING ?? "1"}`,
    `ZIP=${env.ZIP ?? "1"}`,
    `JVMARGS=${env.JVMARGS ?? ""}`,
  ];

  const hostPort = String(env.HOST_PORT || "14159");

  const createOptions = {
    name: CONTAINER_NAME,
    Image: info.Config.Image,
    Env: containerEnv,
    ExposedPorts: info.Config.ExposedPorts,
    // Explicit constants, not cloned from info.Config: stdin must stay open
    // for the live console feature (see console.js) to keep working across
    // recreates -- cloning HostConfig (below) does NOT carry these over,
    // since they live on Config, not HostConfig. Silently losing this here
    // would make console features start failing only after the next config
    // apply, which is a nasty one to debug.
    OpenStdin: true,
    StdinOnce: false,
    Tty: false,
    // Carry forward Docker Compose's own tracking labels (project/service/
    // config-hash/etc). Without this, the container this function creates
    // is invisible to `docker compose`'s bookkeeping -- the NEXT `docker
    // compose up` (even one only targeting a different service, since
    // compose evaluates the whole dependency graph) sees an "untracked"
    // container holding the name it wants and fails with a naming conflict
    // instead of recognizing it as already up to date. Confirmed via a real
    // `docker compose up -d ui` failing this way after this function had
    // recreated necesse-server once.
    Labels: info.Config.Labels,
    HostConfig: {
      ...info.HostConfig,
      PortBindings: {
        "14159/udp": [{ HostIp: "0.0.0.0", HostPort: hostPort }],
      },
    },
  };

  await container.stop({ t: 15 }).catch((err) => {
    if (err.statusCode !== 304 && err.statusCode !== 404) throw err;
  });
  await container.remove().catch((err) => {
    if (err.statusCode !== 404) throw err;
  });

  const created = await docker.createContainer(createOptions);
  if (wasRunning) await created.start();

  return { id: created.id, started: wasRunning };
}

module.exports = {
  getStatus,
  start,
  stop,
  restart,
  recreateNecesseContainer,
  CONTAINER_NAME,
};
