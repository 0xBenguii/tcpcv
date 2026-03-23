import { Socket, createServer, AddressInfo } from 'net';
import { existsSync, statSync, readFileSync } from 'fs';
import { sprintf, vsprintf } from 'sprintf-js';
import * as wrap from 'word-wrap';
import * as meow from 'meow';
import * as signale from 'signale';
import * as figlet from 'figlet';


const ANSI = {
  reset:    '\x1b[0m',
  bold:     '\x1b[1m',
  bBlack:   '\x1b[90m',
  bRed:     '\x1b[91m',
  bGreen:   '\x1b[92m',
  bYellow:  '\x1b[93m',
  bCyan:    '\x1b[96m',
  bWhite:   '\x1b[97m',
};

const c       = (code: string, t: string) => `${code}${t}${ANSI.reset}`;
const cyan    = (t: string) => c(ANSI.bCyan,   t);
const green   = (t: string) => c(ANSI.bGreen,  t);
const yellow  = (t: string) => c(ANSI.bYellow, t);
const red     = (t: string) => c(ANSI.bRed,    t);
const white   = (t: string) => c(ANSI.bWhite,  t);
const dim     = (t: string) => c(ANSI.bBlack,  t);
const bold    = (t: string) => `${ANSI.bold}${t}${ANSI.reset}`;

const cli = meow(`
  Usage:
    tcpcv [options]

  Options:
    --help            Display this help message
    --motd[=MOTD]     The hero text to display on connection (default: TCPCV)
    --port[=PORT]     The port to listen on (default: 2468)
    --resume[=RESUME] Path to the resume file (default: resume.json)
    --version         Display this application version
`, {
  flags: {
    motd:   { type: 'string', default: 'TCPCV' },
    port:   { type: 'number', default: 2468 },
    resume: { type: 'string', default: 'resume.json' }
  }
});

signale.config({ displayBadge: true, displayTimestamp: true, displayDate: true });

if (!existsSync(cli.flags.resume)) {
  const error = new Error(`No such file or directory, '${cli.flags.resume}'`);
  signale.fatal(error);
  throw error;
}

signale.info('Loading resume from', cli.flags.resume);

const stats  = statSync(cli.flags.resume);
const resume = JSON.parse(readFileSync(cli.flags.resume, 'utf8'));

const MAX_INPUT       = 256;   // max chars per command
const MAX_CONNECTIONS = 10;    // max simultaneous connections
const SOCKET_TIMEOUT  = 60000; // 60s inactivity timeout

const sockets  = new Array<Socket>();
let lastInput  = '';

const stripAnsi = (str: string): string =>
  str.replace(/\x1b\[[0-9;]*m/g, '');

const padEnd = (str: string, width: number, char = ' '): string => {
  const visible = stripAnsi(str).length;
  return str + char.repeat(Math.max(0, width - visible));
};

const SEP = dim('─'.repeat(80)) + '\n';

const cleanInput = (data: string): string => {
  const ctrld = Buffer.from('04');
  if (Buffer.from(data) === ctrld) return 'exit';
  return data.toString()
    .replace(/(\r\n|\n|\r)/gm, '')
    .toLowerCase()
    .slice(0, MAX_INPUT);
};

const sendData = (socket: Socket, data: string): void => {
  socket.write(data);
  socket.write(green('$') + ' ');
};

const resumeSection = (section: string): string => {
  let output = '';

  if (!Object.prototype.hasOwnProperty.call(resume.sections, section)) {
    return output;
  }

  const sec = resume.sections[section];

  output += SEP;
  output += bold(cyan(sec.title)) + '  ' + dim(sec.description) + '\n';
  output += SEP;

  let stringlast = false;

  for (const block of sec.data) {
    if (typeof block === 'string' || block instanceof String) {
      const line = block as string;

      if (line.trim() === '') {
        output += '\n';
      } else if (line.startsWith('---')) {
        // Sub-category header
        output += '\n' + yellow(line) + '\n';
      } else {
        output += white(line) + '\n';
      }

      stringlast = true;
    } else {
      if (Object.prototype.hasOwnProperty.call(block, 'header')) {
        const left  = bold(white(block.header[0]));
        const right = dim(block.header[1]);
        const pad   = 35 + (left.length - stripAnsi(left).length);
        output += padEnd(left, pad) + cyan('  :  ') + right + '\n';
      }

      if (Object.prototype.hasOwnProperty.call(block, 'subheader')) {
        const left  = green(block.subheader[0]);
        const right = dim(block.subheader[1]);
        const pad   = 43 + (left.length - stripAnsi(left).length);
        output += padEnd(left, pad) + dim('  :  ') + right + '\n';
      }

      if (Object.prototype.hasOwnProperty.call(block, 'body')) {
        output += dim(wrap(block.body, { indent: '    ', width: 76 })) + '\n';
      }

      output += '\n';
      stringlast = false;
    }
  }

  if (stringlast) output += '\n';

  return output;
};

const receiveData = (socket: Socket, data: string) => {
  let cleanData = cleanInput(data);

  if (cleanData === '!!') {
    cleanData = lastInput;
  } else {
    lastInput = cleanData;
  }

  let output = '';

  switch (cleanData) {
    case '':
      sendData(socket, output);
      break;

    case 'quit':
    case 'exit':
      socket.end(cyan('Goodbye!') + dim(' — Stay curious.\n'));
      break;

    case 'help':
      output += bold(white('Built-in commands')) + '\n';
      output += dim("Type 'help resume' for section commands.\n") + '\n';
      output += `  ${cyan('resume')}   ${dim('::')}  Afficher le CV complet\n`;
      output += `  ${cyan('cv')}       ${dim('::')}  Alias de resume\n`;
      output += `  ${cyan('whoami')}   ${dim('::')}  Qui suis-je ?\n`;
      output += `  ${cyan('clear')}    ${dim('::')}  Vider le terminal\n`;
      output += `  ${cyan('help')}     ${dim('::')}  Afficher ce message\n`;
      output += `  ${cyan('exit')}     ${dim('::')}  Fermer la connexion\n`;
      output += '\n';
      sendData(socket, output);
      break;

    case 'help cv':
    case 'help resume':
      output += bold(white('Sections disponibles')) + '\n\n';
      output += `  ${padEnd(yellow('resume'), 26)}${dim('::')}  CV complet\n`;

      for (const section in resume.sections) {
        if (Object.prototype.hasOwnProperty.call(resume.sections, section)) {
          const cmd = cyan(`resume ${section}`);
          output += `  ${padEnd(cmd, 26 + (cmd.length - stripAnsi(cmd).length))}${dim('::')}  ${dim(resume.sections[section].description)}\n`;
        }
      }

      output += '\n';
      sendData(socket, output);
      break;

    case 'whoami':
      output += green('0xBenguii') + '\n';
      sendData(socket, output);
      break;

    case 'clear':
      socket.write('\x1b[2J\x1b[H');
      sendData(socket, '');
      break;

    case 'cv':
    case 'resume':
      for (const section in resume.sections) {
        if (Object.prototype.hasOwnProperty.call(resume.sections, section)) {
          output += resumeSection(section);
        }
      }
      sendData(socket, output);
      break;

    default:
      if (/^(resume|cv) /.test(cleanData)) {
        const section = cleanData.replace(/^(resume|cv) /, '');

        if (Object.prototype.hasOwnProperty.call(resume.sections, section)) {
          sendData(socket, resumeSection(section));
          break;
        }
      }

      sendData(socket, red('-resume: ') + white(cleanData) + dim(': command not found\n'));
      break;
  }
};


const closeSocket = (socket: Socket) => {
  const i = sockets.indexOf(socket);
  if (i !== -1) sockets.splice(i, 1);
  signale.info('Connection closed from', socket.remoteAddress);
};

const newSocket = (socket: Socket) => {
  // max co pour sauver ma ram
  if (sockets.length >= MAX_CONNECTIONS) {
    signale.warn('Max connections reached, rejecting', socket.remoteAddress);
    socket.end(red('Too many connections. Try again later.\n'));
    return;
  }

  signale.info('New connection from', socket.remoteAddress);
  sockets.push(socket);

  socket.setTimeout(SOCKET_TIMEOUT);
  socket.on('timeout', () => {
    signale.warn('Session timeout for', socket.remoteAddress);
    socket.end(dim('\nSession timeout — reconnect when ready.\n'));
  });

  socket.on('error', (err) => {
    signale.warn('Socket error from', socket.remoteAddress, err.message);
    closeSocket(socket);
  });

  // Header
  socket.write('\n');
  socket.write(dim(`  Last updated: ${stats.mtime.toUTCString()}`) + '\n\n');

  // ASCII MOTD cyan
  const motd = figlet.textSync(cli.flags.motd, { font: 'Standard' });
  socket.write(motd.split('\n').map(l => cyan(l)).join('\n'));
  socket.write('\n\n');


  socket.write(dim('  ') + green('◈') + dim(' Admin. Sys. DevOps · Cybersécurité · 0xBenguii') + '\n');
  socket.write('\n');

  sendData(socket, dim("Type ") + cyan("'help'") + dim(" for available commands.\n"));

  socket.on('data', (data: string) => {
    receiveData(socket, data);
  });

  socket.on('end', () => {
    closeSocket(socket);
  });
};

const server = createServer(newSocket);
server.listen(cli.flags.port);

const { port } = server.address() as AddressInfo;
signale.success(`TCPCV is ready on port ${port} — telnet localhost ${port}`);