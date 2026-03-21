// Autocomplete suggestions for Commands terminal (Server commands)
window.CommandsAutocomplete = [
  // Basic commands
  'help', 'ping', 'status', 'restart', 'reconnect', 'clear', 'exit', 'quit',
  // Testing (fatal — dev only)
  'crash.server', 'crash.client',
  
  // File operations
  'ls', 'list', 'dir', 'cd', 'pwd', 'mkdir', 'rmdir', 'rm', 'del', 'delete',
  'mv', 'move', 'cp', 'copy', 'cat', 'type', 'read', 'write', 'edit',
  'touch', 'chmod', 'chown', 'find', 'grep', 'search', 'replace',
  
  // Git commands
  'git', 'git status', 'git add', 'git commit', 'git push', 'git pull',
  'git clone', 'git branch', 'git checkout', 'git merge', 'git log',
  'git diff', 'git stash', 'git reset', 'git revert', 'git remote',
  'git fetch', 'git rebase', 'git tag', 'git init', 'git config',
  
  // Server management
  'start', 'stop', 'restart', 'reload', 'shutdown', 'kill', 'ps', 'top',
  'uptime', 'whoami', 'hostname', 'uname', 'env', 'export', 'set',
  
  // Network
  'curl', 'wget', 'ping', 'netstat', 'ifconfig', 'ipconfig', 'traceroute',
  'nslookup', 'dig', 'host', 'telnet', 'ssh', 'scp', 'rsync',
  
  // Process management
  'ps', 'top', 'htop', 'kill', 'killall', 'pkill', 'pgrep', 'jobs',
  'fg', 'bg', 'nohup', 'screen', 'tmux',
  
  // Package management
  'npm', 'npm install', 'npm uninstall', 'npm update', 'npm list', 'npm search',
  'npm run', 'npm start', 'npm test', 'npm publish', 'npm init',
  'yarn', 'yarn add', 'yarn remove', 'yarn upgrade', 'yarn install',
  'pip', 'pip install', 'pip uninstall', 'pip list', 'pip freeze',
  
  // Build tools
  'make', 'cmake', 'gcc', 'g++', 'javac', 'python', 'node', 'tsc',
  'webpack', 'rollup', 'vite', 'esbuild', 'babel',
  
  // Database
  'mysql', 'psql', 'mongo', 'redis-cli', 'sqlite3',
  
  // Text processing
  'grep', 'sed', 'awk', 'cut', 'sort', 'uniq', 'wc', 'head', 'tail',
  'less', 'more', 'cat', 'tac', 'nl', 'od', 'hexdump',
  
  // Compression
  'tar', 'zip', 'unzip', 'gzip', 'gunzip', 'bzip2', 'bunzip2', 'xz',
  '7z', 'rar', 'unrar',
  
  // System info
  'df', 'du', 'free', 'lscpu', 'lsblk', 'lspci', 'lsusb', 'dmesg',
  'journalctl', 'systemctl', 'service', 'chkconfig',
  
  // Permissions
  'chmod', 'chown', 'chgrp', 'umask', 'su', 'sudo', 'passwd',
  
  // File search
  'find', 'locate', 'which', 'whereis', 'type', 'where',
  
  // Text editors
  'vim', 'vi', 'nano', 'emacs', 'code', 'subl', 'atom',
  
  // Version control
  'svn', 'hg', 'bzr', 'fossil',
  
  // Monitoring
  'watch', 'tail', 'less', 'dmesg', 'journalctl', 'log', 'logs',
  
  // Utilities
  'date', 'cal', 'bc', 'dc', 'factor', 'seq', 'shuf', 'shuf',
  'yes', 'no', 'true', 'false', 'echo', 'printf', 'test', '[',
  
  // Shell builtins
  'alias', 'unalias', 'export', 'unset', 'source', '.', 'exec',
  'eval', 'readonly', 'declare', 'typeset', 'local', 'return',

  // Other useful commands
  'clear', 'reset', 'tput', 'stty', 'tty', 'who', 'w', 'last',
  'uptime', 'w', 'finger', 'users', 'groups', 'id',
  
  // Node.js commands
  'node', 'npm', 'npx', 'yarn', 'pnpm', 'ts-node', 'tsc', 'tsx',
  'nodemon', 'pm2', 'forever', 'node-gyp', 'nvm', 'n',
  
  // Development tools
  'webpack', 'rollup', 'vite', 'esbuild', 'parcel', 'babel', 'swc',
  'jest', 'mocha', 'jasmine', 'karma', 'cypress', 'playwright', 'puppeteer',
  'eslint', 'prettier', 'stylelint', 'husky', 'lint-staged',
  
  // Build tools
  'make', 'cmake', 'gmake', 'ninja', 'ant', 'maven', 'gradle', 'sbt',
  'cargo', 'go', 'dotnet', 'msbuild', 'xcodebuild',
  
  // Package managers
  'apt', 'apt-get', 'apt-cache', 'yum', 'dnf', 'pacman', 'brew',
  'choco', 'scoop', 'winget', 'pip', 'pip3', 'conda', 'poetry',
  
  // Text editors
  'vim', 'vi', 'nano', 'emacs', 'code', 'subl', 'atom', 'notepad++',
  'gedit', 'kate', 'mousepad', 'leafpad',
  
  // File utilities
  'file', 'stat', 'touch', 'chattr', 'lsattr', 'getfacl', 'setfacl',
  'ln', 'ln -s', 'readlink', 'realpath', 'basename', 'dirname',
  'pathchk', 'mktemp', 'tempfile',
  
  // Archive utilities
  'tar', 'gzip', 'gunzip', 'bzip2', 'bunzip2', 'xz', 'unxz', 'lzma',
  'zip', 'unzip', '7z', '7za', 'rar', 'unrar', 'zcat', 'bzcat', 'xzcat',
  
  // Network utilities
  'curl', 'wget', 'aria2c', 'axel', 'nc', 'netcat', 'socat',
  'ssh', 'scp', 'sftp', 'rsync', 'rclone', 'ftp', 'sftp',
  'telnet', 'nc', 'nmap', 'tcpdump', 'wireshark', 'tshark',
  'dig', 'nslookup', 'host', 'whois', 'traceroute', 'tracepath',
  'mtr', 'iftop', 'nethogs', 'bmon', 'vnstat', 'speedtest-cli',
  
  // System monitoring
  'top', 'htop', 'btop', 'glances', 'nmon', 'iotop', 'atop',
  'vmstat', 'iostat', 'mpstat', 'sar', 'pidstat', 'free', 'df', 'du',
  'lsof', 'fuser', 'strace', 'ltrace', 'perf', 'valgrind',
  
  // Process management
  'ps', 'pstree', 'pgrep', 'pkill', 'killall', 'kill', 'kill -9',
  'nice', 'renice', 'nohup', 'screen', 'tmux', 'byobu', 'dtach',
  'disown', 'jobs', 'fg', 'bg', 'wait', 'timeout', 'watch',
  
  // System information
  'uname', 'hostname', 'hostnamectl', 'uptime', 'whoami', 'id',
  'groups', 'users', 'w', 'who', 'last', 'lastlog', 'finger',
  'lscpu', 'lsmem', 'lsblk', 'lsusb', 'lspci', 'lsmod', 'modinfo',
  'dmidecode', 'lshw', 'inxi', 'neofetch', 'screenfetch',
  
  // Disk utilities
  'fdisk', 'parted', 'gparted', 'cfdisk', 'sfdisk', 'mkfs', 'mkfs.ext4',
  'mkfs.ntfs', 'mkfs.vfat', 'fsck', 'e2fsck', 'mount', 'umount',
  'blkid', 'lsblk', 'df', 'du', 'ncdu', 'baobab', 'gdmap',
  
  // Log viewing
  'tail', 'tail -f', 'head', 'less', 'more', 'cat', 'tac', 'nl',
  'dmesg', 'journalctl', 'syslog', 'logread', 'multitail',
  
  // Text processing
  'grep', 'egrep', 'fgrep', 'rg', 'ag', 'ack', 'sed', 'awk', 'gawk',
  'cut', 'paste', 'join', 'sort', 'uniq', 'comm', 'diff', 'cmp',
  'wc', 'tr', 'fold', 'fmt', 'pr', 'column', 'expand', 'unexpand',
  
  // Search utilities
  'find', 'locate', 'updatedb', 'which', 'whereis', 'type', 'where',
  'fd', 'fzf', 'ripgrep', 'the_silver_searcher',
  
  // Compression
  'compress', 'uncompress', 'zcat', 'zless', 'zmore', 'znew',
  'lz4', 'lzop', 'xz', 'zstd', 'brotli',
  
  // Version control
  'git', 'svn', 'hg', 'bzr', 'fossil', 'cvs', 'rcs',
  'git add', 'git commit', 'git push', 'git pull', 'git clone',
  'git branch', 'git checkout', 'git merge', 'git rebase', 'git stash',
  'git log', 'git diff', 'git status', 'git remote', 'git fetch',
  'git tag', 'git init', 'git config', 'git reset', 'git revert',
  
  // Database clients
  'mysql', 'mysqldump', 'mysqladmin', 'psql', 'pg_dump', 'pg_restore',
  'mongo', 'mongosh', 'redis-cli', 'sqlite3', 'sqlcmd', 'mssql-cli',
  
  // Web servers
  'nginx', 'apache2', 'httpd', 'lighttpd', 'caddy', 'h2o',
  
  // System services
  'systemctl', 'service', 'initctl', 'rc-service', 'sv', 'supervisorctl',
  'systemctl start', 'systemctl stop', 'systemctl restart', 'systemctl status',
  'systemctl enable', 'systemctl disable', 'systemctl list-units',
  
  // Security
  'sudo', 'su', 'passwd', 'chpasswd', 'usermod', 'useradd', 'userdel',
  'groupadd', 'groupdel', 'groupmod', 'chage', 'visudo', 'sudoedit',
  'ssh-keygen', 'ssh-add', 'ssh-copy-id', 'gpg', 'gpg2', 'openssl',
  
  // Network configuration
  'ifconfig', 'ip', 'ipconfig', 'route', 'netstat', 'ss', 'ip route',
  'ip addr', 'ip link', 'iwconfig', 'iwlist', 'nmcli', 'nmtui',
  
  // Firewall
  'iptables', 'ip6tables', 'ufw', 'firewall-cmd', 'firewalld',
  
  // Time/Date
  'date', 'cal', 'calendar', 'timedatectl', 'ntpdate', 'chrony',
  
  // Environment
  'env', 'export', 'set', 'unset', 'printenv', 'setenv', 'source',
  '.', 'alias', 'unalias', 'type', 'which', 'whereis',
  
  // Shell builtins
  'cd', 'pwd', 'pushd', 'popd', 'dirs', 'history', 'fc', 'exec',
  'eval', 'read', 'readonly', 'declare', 'typeset', 'local', 'return',
  'exit', 'logout', 'break', 'continue', 'shift', 'test', '[', '[[',
  'true', 'false', ':', 'echo', 'printf', 'yes', 'seq',
  
  // Redirection and pipes
  '>', '>>', '<', '<<', '|', '&', '&&', '||', ';', ';;',
  
  // Background and job control
  '&', 'nohup', 'disown', 'fg', 'bg', 'jobs', 'wait', 'kill %1',
  
  // Other utilities
  'bc', 'dc', 'factor', 'shuf', 'shuf -i', 'split', 'csplit',
  'tee', 'sponge', 'parallel', 'xargs', 'find -exec', 'find -print0'
];
