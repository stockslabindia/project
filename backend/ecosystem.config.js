module.exports = {
  apps: [{
    name: "tradex-backend",
    script: "src/server.js",
    instances: "max",
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
    },
    node_args: "--max-old-space-size=1500"
  }]
}
