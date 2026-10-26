"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Clipboard,
  Command,
  ExternalLink,
  Gamepad2,
  Code2 as Github,
  Heart,
  Leaf,
  Menu,
  MessageCircle,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  X,
  Zap,
} from "lucide-react";
import commands from "./commands.json";

const repo = "https://github.com/m-ayan-ahmed290/KettleSpiceGatekeeper";
const clientId =
  process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || "1106164007519408128";
const invite = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&permissions=1099780189376&scope=bot%20applications.commands`;
const categories = [
  "All commands",
  "Community",
  "Moderation",
  "Games",
  "Setup",
];
const games = [
  {
    name: "Tic Tac Toe",
    mode: "Solo or versus",
    command: "/game tictactoe",
    symbol: "✕",
    color: "lilac",
    description:
      "A familiar little rivalry. Challenge a friend or take on the bot.",
  },
  {
    name: "Co-op Dungeon",
    mode: "Two-player co-op",
    command: "/game dungeon partner:@friend",
    symbol: "⚔",
    color: "peach",
    description:
      "One boss. Two adventurers. Share your health, time your potions, and win together.",
  },
  {
    name: "Connect Four",
    mode: "Two-player versus",
    command: "/game connect-four opponent:@friend",
    symbol: "●",
    color: "mint",
    description:
      "Four in a row, one friendly grudge. Challenge someone in your server.",
  },
  {
    name: "Number Guess",
    mode: "Solo",
    command: "/game guess",
    symbol: "?",
    color: "yellow",
    description:
      "A number between 1 and 20. Five guesses. How close can you get?",
  },
  {
    name: "Rock Paper Scissors",
    mode: "Solo",
    command: "/game rps choice:rock",
    symbol: "✌",
    color: "lilac",
    description:
      "A quick decision and a little luck. Play against the bot, right in Discord.",
  },
];
const demoMessages = {
  moderation: {
    command: "/purge amount:10",
    title: "A fresh start for #general",
    text: "Messages cleared. Back to the good conversation.",
    icon: ShieldCheck,
    accent: "mint",
  },
  community: {
    command: "/remind set",
    title: "Future you says thanks",
    text: "Set a personal reminder and get a DM when it’s time.",
    icon: Heart,
    accent: "peach",
  },
  games: {
    command: "/game dungeon partner:@milo",
    title: "Your next adventure is here",
    text: "Invite a friend. Share potions. Take down the boss together.",
    icon: Gamepad2,
    accent: "lilac",
  },
};
type DemoTab = keyof typeof demoMessages;

function Brand({ small = false }: { small?: boolean }) {
  return (
    <a
      className={`brand ${small ? "brand-small" : ""}`}
      href="#home"
      aria-label="Gatekeeper home"
    >
      <span className="brand-mark" aria-hidden="true">
        <span />
        <i />
      </span>
      <span>
        gatekeeper<span className="brand-period">.</span>
      </span>
    </a>
  );
}
function DiscordMark() {
  return (
    <svg
      width="21"
      height="17"
      viewBox="0 0 24 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.6 1.7A18.2 18.2 0 0 0 15.2.3l-.5 1a16.6 16.6 0 0 0-5.4 0l-.5-1a18 18 0 0 0-4.4 1.4C1.6 5.9.8 10 .9 14.1a18 18 0 0 0 5.5 2.8l1.1-1.8-1.7-.9.4-.3a13 13 0 0 0 11.6 0l.4.3-1.7.9 1.1 1.8a18 18 0 0 0 5.5-2.8c.2-4.8-.9-8.8-3.5-12.4ZM8.3 11.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7.4 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}

export default function Home() {
  const [dark, setDark] = useState(false);
  const [menu, setMenu] = useState(false);
  const [tab, setTab] = useState<DemoTab>("moderation");
  const [demoRun, setDemoRun] = useState(false);
  const [category, setCategory] = useState("All commands");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  const [game, setGame] = useState(0);
  const [rps, setRps] = useState("");
  useEffect(() => {
    try {
      setDark(localStorage.getItem("gatekeeper-theme") === "dark");
    } catch {
      /* Storage is optional. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(""), 2200);
    return () => clearTimeout(timer);
  }, [copied]);
  const filtered = useMemo(
    () =>
      commands.filter(
        (c) =>
          (category === "All commands" || c.category === category) &&
          `${c.name} ${c.description} ${c.subcommands.map((s) => s.name).join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase().replace(/^\//, "")),
      ),
    [category, query],
  );
  const visible =
    showAll || query || category !== "All commands"
      ? filtered
      : filtered.slice(0, 6);
  const demo = demoMessages[tab];
  const DemoIcon = demo.icon;
  const activeGame = games[game];
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setCopyError("");
    } catch {
      setCopyError(`Copy unavailable. Select this command: ${value}`);
    }
  }
  function toggleTheme() {
    setDark(!dark);
    try {
      localStorage.setItem("gatekeeper-theme", dark ? "light" : "dark");
    } catch {
      /* Keep the session theme. */
    }
  }
  function playRps(choice: number) {
    const choices = ["Rock", "Paper", "Scissors"];
    const opponent = Math.floor(Math.random() * 3);
    const result =
      opponent === choice
        ? "A draw. Great minds!"
        : (choice - opponent + 3) % 3 === 1
          ? "You win. Nicely played!"
          : "Gatekeeper wins. Rematch?";
    setRps(`You: ${choices[choice]} · Bot: ${choices[opponent]}. ${result}`);
  }
  return (
    <>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="site-header wrap">
        <Brand />
        <nav
          className={menu ? "navigation open" : "navigation"}
          aria-label="Main navigation"
        >
          {["Features", "Games", "Commands"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              onClick={() => setMenu(false)}
            >
              {item}
            </a>
          ))}
          <a href="#setup" onClick={() => setMenu(false)}>
            Get started <ArrowUpRight size={13} />
          </a>
        </nav>
        <div className="nav-actions">
          <button
            className="icon-button theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <a
            className="button button-small button-dark nav-invite"
            href={invite}
            target="_blank"
            rel="noopener noreferrer"
          >
            Add to Discord <ArrowUpRight size={15} />
          </a>
          <button
            className="icon-button mobile-menu"
            aria-label={menu ? "Close navigation" : "Open navigation"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="home">
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <a className="eyebrow-pill" href="#games">
              <span className="status-dot" /> A little more life in your server{" "}
              <ArrowUpRight size={13} />
            </a>
            <h1 id="hero-title">
              A little order.
              <br />A lot more
              <br />
              <span className="good-times">
                good times.
                <svg
                  viewBox="0 0 500 22"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M3 15Q240 -2 495 11" />
                </svg>
              </span>
            </h1>
            <p>
              Your community’s new favorite plus-one. Keep things kind, bring
              people together, and make room for a little fun.
            </p>
            <div className="hero-buttons">
              <a
                className="button button-dark"
                href={invite}
                target="_blank"
                rel="noopener noreferrer"
              >
                <DiscordMark /> Add to Discord <ArrowUpRight size={17} />
              </a>
              <a className="text-link" href="#features">
                Meet Gatekeeper <ArrowDown size={16} />
              </a>
            </div>
            <div className="hero-footnote">
              <span>
                <Check size={14} /> Free & open source
              </span>
              <span>
                <Check size={14} /> Made for your community
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="orbit orbit-one" aria-hidden="true" />
            <div className="orbit orbit-two" aria-hidden="true" />
            <span className="floating-spark spark-one" aria-hidden="true">
              ✳
            </span>
            <span className="floating-spark spark-two" aria-hidden="true">
              ✧
            </span>
            <div className="floating-note glass">
              <span className="note-icon">
                <Leaf size={19} />
              </span>
              <div>
                A calmer corner
                <br />
                <strong>of the internet.</strong>
              </div>
            </div>
            <div className="discord-window glass">
              <div className="window-top">
                <div className="window-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>your little corner</span>
                <span className="window-flower">✳</span>
              </div>
              <div className="discord-channel">
                <span className="hash">#</span>
                <strong>the-good-stuff</strong>
                <span className="channel-divider" />
                <span>make yourself at home</span>
              </div>
              <div className="discord-conversation">
                <div className="chat-avatar human">m</div>
                <div className="chat-content">
                  <div className="chat-author">
                    milo <span>today, a little happier</span>
                  </div>
                  <p>okay, this server just got an upgrade 🌱</p>
                </div>
              </div>
              <div className="discord-conversation bot-conversation">
                <div className="chat-avatar bot">
                  <span className="mini-gate" />
                </div>
                <div className="chat-content">
                  <div className="chat-author">
                    Gatekeeper{" "}
                    <span className="app-badge">
                      <Check size={9} /> APP
                    </span>
                  </div>
                  <p>A little help goes a long way.</p>
                  <div className={`demo-response ${demo.accent}`}>
                    <div className="demo-response-title">
                      <DemoIcon size={19} />
                      <strong>
                        {demoRun ? demo.title : "Good things start here."}
                      </strong>
                    </div>
                    <p>
                      {demoRun
                        ? demo.text
                        : "From a tidy chat to your next co-op adventure. I’ve got you."}
                    </p>
                    <span className="demo-response-footer">
                      <CheckCheck size={12} />{" "}
                      {demoRun ? "Preview complete" : "Here for your community"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="demo-composer">
                <code>{demo.command}</code>
                <button
                  onClick={() => setDemoRun(true)}
                  aria-label="Run command preview"
                >
                  <ArrowRight size={18} />
                </button>
              </div>
              <div className="demo-caption">
                Interactive preview · no Discord connection
              </div>
            </div>
            <div className="demo-switch glass" aria-label="Preview category">
              {(Object.keys(demoMessages) as DemoTab[]).map((t) => (
                <button
                  key={t}
                  className={tab === t ? "selected" : ""}
                  aria-pressed={tab === t}
                  onClick={() => {
                    setTab(t);
                    setDemoRun(false);
                  }}
                >
                  {t === "moderation" ? (
                    <ShieldCheck size={15} />
                  ) : t === "games" ? (
                    <Gamepad2 size={15} />
                  ) : (
                    <Heart size={15} />
                  )}
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="floating-badge glass">
              <span>✦</span> Less busywork. More belonging.
            </div>
          </div>
        </section>
        <div className="promise-strip wrap">
          <span>SMALL BOT. BIG COMMUNITY ENERGY.</span>
          <div>
            <ShieldCheck /> Thoughtful moderation
          </div>
          <div>
            <Users /> Your server, your rules
          </div>
          <div>
            <Gamepad2 /> Built-in good times
          </div>
          <div>
            <Zap /> Light on resources
          </div>
        </div>

        <section
          id="features"
          className="section wrap"
          aria-labelledby="features-title"
        >
          <div className="section-heading">
            <div>
              <span className="kicker">
                <span /> THE EVERYDAY, MADE BETTER
              </span>
              <h2 id="features-title">
                A good community
                <br />
                has a little help.
              </h2>
            </div>
            <p>
              The practical stuff. The thoughtful stuff.
              <br />
              And the “one more game?” stuff.
              <br />
              All in one friendly bot.
            </p>
          </div>
          <div className="feature-grid">
            <article className="feature-card glass">
              <div className="feature-icon mint">
                <ShieldCheck />
              </div>
              <h3>Keep the good vibes.</h3>
              <p>
                Moderation tools, blocked words, slowmode, and message cleanup.
                A calmer chat starts with the right tools.
              </p>
              <div className="feature-mini moderation-mini">
                <div>
                  <span className="mini-status">
                    <Check size={11} />
                  </span>{" "}
                  A little less noise.
                  <span className="tiny-tag">CLEANED UP</span>
                </div>
                <div>
                  <span className="mini-status">
                    <Check size={11} />
                  </span>{" "}
                  A lot more conversation.
                </div>
                <div className="mini-command">
                  <Command size={13} />
                  <code>/purge</code>
                  <code>/slowmode</code>
                </div>
              </div>
              <a
                href="#commands"
                onClick={() => {
                  setCategory("Moderation");
                  setShowAll(true);
                }}
              >
                A kinder corner <ArrowUpRight size={17} />
              </a>
            </article>
            <article className="feature-card glass">
              <div className="feature-icon peach">
                <Heart />
              </div>
              <h3>Remember the little things.</h3>
              <p>
                Birthday wishes, personal reminders, profiles, and polls. Give
                your members more reasons to feel at home.
              </p>
              <div className="feature-mini birthday-mini">
                <div className="birthday-emoji" aria-hidden="true">
                  ✿
                </div>
                <div>
                  <strong>Here’s to you, birthday human.</strong>
                  <span>Another trip around the sun. 🎂</span>
                </div>
                <span className="birthday-star" aria-hidden="true">
                  ✧
                </span>
              </div>
              <a
                href="#commands"
                onClick={() => {
                  setCategory("Community");
                  setShowAll(true);
                }}
              >
                Make it feel like home <ArrowUpRight size={17} />
              </a>
            </article>
            <article className="feature-card glass">
              <div className="feature-icon lilac">
                <Gamepad2 />
              </div>
              <h3>Turn a chat into a hangout.</h3>
              <p>
                Solo challenges, friendly rivalries, and co-op adventures. No
                downloads. Just a command and good company.
              </p>
              <div className="feature-mini game-mini">
                <div className="mini-board" aria-hidden="true">
                  {["✕", "", "○", "", "✕", "", "○", "", "✕"].map((s, i) => (
                    <span className={s === "✕" ? "cross" : ""} key={i}>
                      {s}
                    </span>
                  ))}
                </div>
                <div>
                  <span className="tiny-tag">YOUR NEXT MATCH</span>
                  <strong>
                    A little friendly
                    <br />
                    competition?
                  </strong>
                </div>
              </div>
              <a href="#games">
                Find your next game <ArrowUpRight size={17} />
              </a>
            </article>
          </div>
          <div className="feature-foot">
            <span>
              <span className="small-orbit">◎</span> One bot. Every server gets
              its own settings.
            </span>
            <span>
              Open source, and easy to make your own.{" "}
              <a
                href={repo}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
              >
                <Github size={17} />
              </a>
            </span>
          </div>
        </section>

        <section
          id="games"
          className="games-section"
          aria-labelledby="games-title"
        >
          <div className="wrap games-layout">
            <div className="games-copy">
              <span className="kicker">
                <span /> SIDE QUESTS ENCOURAGED
              </span>
              <h2 id="games-title">
                Good company.
                <br />
                <em>Great rematches.</em>
              </h2>
              <p>
                Turn “anyone around?” into your next favorite server memory.
                Five games, right where you already hang out.
              </p>
              <div className="game-selector" aria-label="Explore games">
                {games.map((g, i) => (
                  <button
                    key={g.name}
                    aria-pressed={game === i}
                    className={game === i ? "active" : ""}
                    onClick={() => {
                      setGame(i);
                      setRps("");
                    }}
                  >
                    <span>{g.symbol}</span>
                    <span>
                      {g.name}
                      <small>{g.mode}</small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
              </div>
            </div>
            <div className={`game-showcase glass ${activeGame.color}`}>
              <div className="showcase-top">
                <span>
                  <span className="status-dot" /> THE GAME ROOM
                </span>
                <span>{String(game + 1).padStart(2, "0")} / 05</span>
              </div>
              <div className="game-art" aria-hidden="true">
                {game === 0 ? (
                  <div className="big-board">
                    {["✕", "○", "", "", "✕", "○", "", "", "✕"].map((v, i) => (
                      <span key={i} className={v === "✕" ? "cross" : ""}>
                        {v}
                      </span>
                    ))}
                  </div>
                ) : game === 2 ? (
                  <div className="connect-board">
                    {Array.from({ length: 28 }, (_, i) => (
                      <span
                        key={i}
                        className={
                          i > 13
                            ? i % 3 === 0
                              ? "coin-peach"
                              : "coin-green"
                            : ""
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className={`game-symbol symbol-${game}`}>
                    {activeGame.symbol}
                    <span>✦</span>
                    <i>✧</i>
                  </div>
                )}
              </div>
              <span className="game-mode">{activeGame.mode}</span>
              <h3>{activeGame.name}</h3>
              <p>{activeGame.description}</p>
              {game === 4 && (
                <div className="rps-demo">
                  <span>Try a quick browser round</span>
                  <div>
                    {["Rock", "Paper", "Scissors"].map((v, i) => (
                      <button key={v} onClick={() => playRps(i)}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <p role="status">
                    {rps || "Pick your move. No account needed."}
                  </p>
                </div>
              )}
              <button
                className="copy-command"
                onClick={() => copy(activeGame.command)}
              >
                <code>{activeGame.command}</code>
                {copied === activeGame.command ? (
                  <Check size={16} />
                ) : (
                  <Clipboard size={16} />
                )}
                <span className="sr-only">Copy game command</span>
              </button>
              <span className="game-disclaimer">
                Server game progress is saved by the bot. This page is a
                preview.
              </span>
            </div>
          </div>
        </section>

        <section
          id="commands"
          className="section wrap commands-section"
          aria-labelledby="commands-title"
        >
          <div className="section-heading">
            <div>
              <span className="kicker">
                <span /> A COMMAND FOR THAT
              </span>
              <h2 id="commands-title">
                Less clicking around.
                <br />
                More getting along.
              </h2>
            </div>
            <p>
              Get to know all {commands.length} commands.
              <br />
              Type a slash in Discord. Take it from there.
            </p>
          </div>
          <div className="command-toolbar">
            <div className="category-tabs" aria-label="Filter commands">
              {categories.map((c) => (
                <button
                  className={category === c ? "active" : ""}
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => {
                    setCategory(c);
                    setExpanded(null);
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="search-box">
              <Search size={17} />
              <input
                aria-label="Search commands"
                placeholder="Find a command…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>/</kbd>
            </label>
          </div>
          <div className="command-list">
            {visible.map((c) => (
              <article
                key={c.name}
                className={`command-row glass ${expanded === c.name ? "expanded" : ""}`}
              >
                <button
                  className="command-main"
                  aria-expanded={expanded === c.name}
                  aria-controls={`command-${c.name}`}
                  onClick={() =>
                    setExpanded(expanded === c.name ? null : c.name)
                  }
                >
                  <span className="slash-icon">/</span>
                  <span className="command-name">
                    /{c.name}
                    <small>{c.description}</small>
                  </span>
                  <span className="command-category">{c.category}</span>
                  <ChevronDown className="command-chevron" size={18} />
                </button>
                <div
                  id={`command-${c.name}`}
                  hidden={expanded !== c.name}
                  className="command-details"
                >
                  <p>
                    {c.admin
                      ? "Requires the server permissions assigned to this command. Discord shows commands available to your account."
                      : "Available to members. Server settings and bot permissions can affect availability."}
                  </p>
                  {c.subcommands.length > 0 && (
                    <div className="subcommands">
                      {c.subcommands.map((s) => (
                        <div key={s.name}>
                          <code>
                            /{c.name} {s.name}
                          </code>
                          <span>{s.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    className="text-link"
                    onClick={() => copy(`/${c.name}`)}
                  >
                    {copied === `/${c.name}` ? (
                      <Check size={14} />
                    ) : (
                      <Clipboard size={14} />
                    )}
                    {copied === `/${c.name}` ? "Copied" : "Copy command"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="empty-state">
              <Search size={25} />
              <h3>No commands found.</h3>
              <p>Try another keyword, or explore a different category.</p>
              <button
                className="text-link"
                onClick={() => {
                  setQuery("");
                  setCategory("All commands");
                }}
              >
                Clear filters <ArrowRight size={15} />
              </button>
            </div>
          )}
          <div className="command-list-foot">
            <span aria-live="polite">
              Showing {visible.length} of {filtered.length} commands
            </span>
            {!query && category === "All commands" && (
              <button
                className="text-link"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll
                  ? "Show fewer commands"
                  : `Explore all ${commands.length} commands`}
                <ChevronDown size={16} className={showAll ? "rotate" : ""} />
              </button>
            )}
          </div>
        </section>

        <section
          id="setup"
          className="section wrap setup-section"
          aria-labelledby="setup-title"
        >
          <div className="section-heading">
            <div>
              <span className="kicker">
                <span /> MAKE YOURSELF AT HOME
              </span>
              <h2 id="setup-title">
                Three steps.
                <br />A happier server.
              </h2>
            </div>
            <a
              className="text-link"
              href={`${repo}/blob/main/MULTI_GUILD.md`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the full setup guide <ArrowUpRight size={16} />
            </a>
          </div>
          <div className="setup-grid">
            {[
              {
                n: "01",
                icon: MessageCircle,
                title: "Say hello.",
                text: "Invite Gatekeeper to a server you manage. Review the permissions in Discord, then choose your server.",
              },
              {
                n: "02",
                icon: Command,
                title: "Make it yours.",
                text: "Run /setup view as an administrator. Choose your channels, role rules, and the features you want to enable.",
              },
              {
                n: "03",
                icon: Sparkles,
                title: "Let the good times in.",
                text: "Try /help, start a game, or set your first reminder. Your server’s settings and data stay scoped to your server.",
              },
            ].map((s) => (
              <article className="setup-card" key={s.n}>
                <div>
                  <span>{s.n}</span>
                  <s.icon size={22} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="faq-section wrap" aria-labelledby="faq-title">
          <div>
            <span className="kicker">
              <span /> GOOD QUESTIONS
            </span>
            <h2 id="faq-title">
              A few things
              <br />
              you might wonder.
            </h2>
          </div>
          <div className="faq-list">
            {[
              [
                "Is Gatekeeper free?",
                "Yes. Gatekeeper’s source code is available on GitHub under the ISC license. Hosting your own bot may have costs depending on the provider you choose.",
              ],
              [
                "Does it work in more than one server?",
                "Yes. Each server has its own settings, channels, credits, birthdays, and arcade statistics. New servers start with automation disabled; an administrator can configure features using /setup.",
              ],
              [
                "Can I manage the bot from this website?",
                "This is the public guide and invite site. Manage your server in Discord using /setup and the moderation commands. This site does not access your Discord account, database, or private dashboard API.",
              ],
              [
                "Can I keep my existing Kettle server data?",
                "Yes. Keep the same MongoDB database and follow KETTLE_SETUP.md in the repository. The migration retains original records. Administrators can inspect duplicate-record warnings using /migration-review.",
              ],
              [
                "Where should I host the website?",
                "The website exports to static HTML, CSS, and JavaScript. Host those files on a static hosting provider, or deploy the Next.js source on Vercel. Keep the website separate from your small Wispbyte bot container.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>
                    <ChevronDown size={18} />
                  </span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta wrap">
          <div className="cta-inner glass">
            <div className="cta-orbit" aria-hidden="true" />
            <span className="cta-flower" aria-hidden="true">
              ✳
            </span>
            <span className="kicker">YOUR PEOPLE. YOUR PLACE.</span>
            <h2>
              Make room for
              <br />
              <em>something good.</em>
            </h2>
            <p>Your next favorite server member is one invite away.</p>
            <a
              className="button button-dark"
              href={invite}
              target="_blank"
              rel="noopener noreferrer"
            >
              <DiscordMark /> Add Gatekeeper to Discord{" "}
              <ArrowUpRight size={17} />
            </a>
            <span className="cta-note">
              A little help. A whole lot of possibility.
            </span>
          </div>
        </section>
      </main>
      <footer className="site-footer wrap">
        <div>
          <Brand small />
          <p>Good company for your community.</p>
        </div>
        <div className="footer-links">
          <a href={repo} target="_blank" rel="noopener noreferrer">
            GitHub <ArrowUpRight size={13} />
          </a>
          <a
            href={`${repo}/releases/tag/v3.0.2`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Download bot <ArrowUpRight size={13} />
          </a>
          <a href={`${repo}/issues`} target="_blank" rel="noopener noreferrer">
            Get help <ExternalLink size={12} />
          </a>
        </div>
        <span>
          Built with a little care. <Heart size={13} />
        </span>
      </footer>
      <div className="copy-feedback" role="status" aria-live="polite">
        {copied ? (
          <span>
            <Check size={16} /> Command copied. See you in Discord.
          </span>
        ) : copyError ? (
          <span>
            {copyError}
            <button
              className="icon-button"
              onClick={() => setCopyError("")}
              aria-label="Dismiss copy error"
            >
              <X size={16} />
            </button>
          </span>
        ) : null}
      </div>
    </>
  );
}
