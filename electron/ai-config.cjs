function configurations(script, directory, node = "node") {
  const args = [
    script.replaceAll("\\", "/"),
    `--data-dir=${directory.replaceAll("\\", "/")}`,
  ];
  return {
    codex: `[mcp_servers.pebble]\ncommand = ${JSON.stringify(node)}\nargs = ${JSON.stringify(args)}\nstartup_timeout_sec = 15\n`,
    claude: JSON.stringify(
      { mcpServers: { pebble: { command: node, args } } },
      null,
      2,
    ),
  };
}
module.exports = { configurations };
