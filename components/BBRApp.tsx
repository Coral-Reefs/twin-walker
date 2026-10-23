"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  homes,
  places,
  parking,
  profiles,
  options,
  defaultStops,
  defaultStopsFor,
  simulate,
  precinctImpact,
  homeCandidates,
  network,
  distance,
  park,
  type Place,
  type Stop,
  type Point,
} from "@/lib/bbr/engine";
import { castVote, startJurySync, submitSuggestion } from "@/lib/jury/api";
const Map = dynamic(() => import("./map/BBRMap"), {
  ssr: false,
  loading: () => <div className="map-loading">Opening Bandar Bukit Raja…</div>,
});
type Suggestion = { text: string; place: string };
const fmt = (n: number) => n.toFixed(1);
export default function BBRApp() {
  const [profileId, setProfile] = useState("parent"),
    [home, setHome] = useState<Place>(homes[0]!),
    [stops, setStops] = useState<Stop[]>(() => defaultStopsFor("parent")),
    [routineOwner, setRoutineOwner] = useState<string>("parent"),
    [active, setActive] = useState<string[]>([]);
  const [tab, setTab] = useState("routine"),
    [view, setView] = useState("explore"),
    [selected, setSelected] = useState<Place | null>(null),
    [pinHome, setPinHome] = useState(false),
    [parkingVisible, setParkingVisible] = useState(true),
    [compare, setCompare] = useState(false),
    [search, setSearch] = useState("");
  const [departure, setDeparture] = useState(profiles[0]!.defaultDeparture),
    [budget, setBudget] = useState(90),
    [searchMin, setSearchMin] = useState(4),
    [showPrecinct, setShowPrecinct] = useState(false),
    [progress, setProgress] = useState(0),
    [playing, setPlaying] = useState(false),
    [mobile, setMobile] = useState(false),
    [journeyExpanded, setJourneyExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]),
    [suggestion, setSuggestion] = useState(""),
    [votes, setVotes] = useState<Record<string, number>>({}),
    [voted, setVoted] = useState(""),
    [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const sidebarContent = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected && sidebarContent.current)
      sidebarContent.current.scrollTop = 0;
  }, [selected]);
  const profile = profiles.find((p) => p.id === profileId)!;
  const baseline = useMemo(
    () => simulate(home, stops, profile, [], searchMin, departure),
    [home, stops, profile, searchMin, departure],
  );
  const result = useMemo(
    () => simulate(home, stops, profile, active, searchMin, departure),
    [home, stops, profile, active, searchMin, departure],
  );
  const comparisons = useMemo(
    () =>
      profiles.map((p) => {
        const perStops = defaultStopsFor(p.id);
        const perDeparture = p.defaultDeparture;
        return {
          p,
          stops: perStops,
          before: simulate(home, perStops, p, [], searchMin, perDeparture),
          after: simulate(home, perStops, p, active, searchMin, perDeparture),
        };
      }),
    [home, active, searchMin],
  );
  const impacts = useMemo(
    () =>
      options.map((o) => ({
        o,
        rows: profiles.map((p) => {
          const perStops = defaultStopsFor(p.id);
          const perDeparture = p.defaultDeparture;
          return {
            p,
            b: simulate(home, perStops, p, [], searchMin, perDeparture),
            a: simulate(home, perStops, p, [o.id], searchMin, perDeparture),
          };
        }),
      })),
    [home, searchMin],
  );
  const precinct = useMemo(
    () =>
      precinctImpact(stops, profile, active, budget, searchMin, departure),
    [stops, profile, active, budget, searchMin, departure],
  );
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("dayzero-bbr-jury") || "{}",
      );
      setVotes(saved.votes || {});
      setSuggestions(saved.suggestions || []);
      setVoted(saved.voted || "");
    } catch {
      setNotice("Saved feedback could not be read. You can start again.");
    }
  }, []);
  useEffect(() => startJurySync(), []);
  useEffect(() => {
    setProgress(0);
    setPlaying(false);
  }, [result]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setProgress((p) => Math.min(1, p + 0.005)),
      100,
    );
    return () => clearInterval(timer);
  }, [playing]);
  useEffect(() => {
    if (progress >= 1) setPlaying(false);
  }, [progress]);
  const update = (i: number, patch: Partial<Stop>) =>
    setStops((s) => s.map((v, j) => (i === j ? { ...v, ...patch } : v)));
  const add = (p: Place) => {
    if (stops.length >= 6) {
      setNotice("This MVP supports up to six destinations.");
      return;
    }
    setStops((s) => [
      ...s,
      {
        placeId: p.id,
        mode: "walk",
        parkingId: parking
          .slice()
          .sort((a, b) => distance(a, p) - distance(b, p))[0]!.id,
        dwell: 10,
      },
    ]);
    setNotice(`${p.name} added to your day.`);
  };
  const toggle = (id: string) =>
    setActive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const chooseProfile = (id: string) => {
    setProfile(id);
    const already = JSON.stringify(stops) === JSON.stringify(defaultStopsFor(routineOwner));
    if (already) {
      setStops(defaultStopsFor(id));
      setDeparture(profiles.find((p) => p.id === id)!.defaultDeparture);
      setRoutineOwner(id);
    }
  };
  const resetRoutineFor = (id: string) => {
    setStops(defaultStopsFor(id));
    setDeparture(profiles.find((p) => p.id === id)!.defaultDeparture);
    setRoutineOwner(id);
  };
  const setPinnedHome = (p: Point) => {
    setHome({
      ...p,
      id: "custom-home",
      name: "Your pinned home",
      kind: "home",
      source: "User-selected location; entrance unverified",
    });
    setPinHome(false);
  };
  const persist = (
    v: Record<string, number>,
    s: Suggestion[],
    choice: string,
  ) => {
    try {
      localStorage.setItem(
        "dayzero-bbr-jury",
        JSON.stringify({ votes: v, suggestions: s, voted: choice }),
      );
      setNotice("Saved on this device.");
    } catch {
      setNotice("Storage unavailable. Feedback remains in this session only.");
    }
  };
  const vote = (id: string) => {
    const next = { ...votes };
    if (voted) next[voted] = Math.max(0, (next[voted] || 0) - 1);
    next[id] = (next[id] || 0) + 1;
    setVotes(next);
    setVoted(id);
    persist(next, suggestions, id);
    void castVote(id).then((r) => {
      if (r === "sent")
        setNotice("Saved on this device and shared with the planning team.");
      else if (r === "queued")
        setNotice("Saved on this device. It will be shared when you are back online.");
    });
  };
  const saved = baseline.minutes - result.minutes;
  const arrival = () => {
    const [h = 8, m = 0] = departure.split(":").map(Number);
    const total = h * 60 + m + Math.round(result.minutes);
    return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}${total >= 1440 ? " (+1 day)" : ""}`;
  };
  const filtered = places.filter(
    (p) =>
      p.kind !== "home" && p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="dayzero-shell">
      <a href="#journey-controls" className="skip-link">
        Skip to journey controls
      </a>
      <header className="dz-header">
        <a className="dz-brand" href="/" aria-label="DayZero home">
          <span className="brand-symbol">
            d<span>0</span>
          </span>
          <strong>
            dayzero<span className="brand-dot">.</span>
          </strong>
        </a>
        <span className="header-divider" />
        <a
          className="township-title"
          href="https://simedarbyproperty.com/bandar-bukit-raja/index.html"
          target="_blank"
          rel="noreferrer"
        >
          Bandar Bukit Raja ↗
          <small>Klang, Selangor · Township living lab</small>
        </a>
        <nav aria-label="Main views">
          {[
            ["explore", "Explore a day"],
            ["compare", "Compare impact"],
            ["jury", "Resident jury"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id!)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button
          className="evidence-button"
          onClick={() => dialog.current?.showModal()}
        >
          ◉ Data & assumptions
        </button>
      </header>
      {/* <div className="context-strip">
        <span>
          <i /> REAL GEOGRAPHY. EVERYDAY POSSIBILITIES.
        </span>
        <span>
          Study-area prototype <b>•</b> Illustrative assumptions
        </span>
      </div> */}
      <main className="dz-workspace">
        <aside
          id="journey-controls"
          className={"dz-sidebar " + (mobile ? "mobile-open" : "")}
        >
          {/* <div className="sidebar-heading">
            <span className="eyebrow">YOUR DAY, REIMAGINED</span>
            <h1>
              A place that works
              <br />
              for your life.
            </h1>
            <p>Test the small journeys that shape an ordinary day.</p>
          </div> */}
          <div className="sidebar-tabs" aria-label="Journey controls">
            {[
              ["resident", "Resident"],
              ["routine", "Your routine"],
              ["design", "Design lab"],
            ].map(([id, label]) => (
              <button
                aria-pressed={tab === id}
                key={id}
                onClick={() => setTab(id!)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="sidebar-content" ref={sidebarContent}>
            {selected && (
              <div className="place-card">
                <button
                  className="close-card"
                  aria-label="Close place details"
                  onClick={() => setSelected(null)}
                >
                  ×
                </button>
                <span className="eyebrow">
                  {selected.kind.replaceAll("_", " ")}
                </span>
                <h3>{selected.name}</h3>
                <p>{selected.source}</p>
                <small>
                  {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}
                </small>
                {selected.kind === "parking" ? (
                  <div className="soft-card">
                    Fees · hours · accessible bays: <b>unknown</b>
                    <br />
                    Search: {searchMin} min + 1 min parking (assumed)
                  </div>
                ) : (
                  selected.id !== "custom-home" && (
                    <button
                      className="primary full"
                      onClick={() => add(selected)}
                    >
                      + Add to my day
                    </button>
                  )
                )}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lon}#map=18/${selected.lat}/${selected.lon}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View location source ↗
                </a>
              </div>
            )}

            {tab === "resident" && (
              <>
                <div className="section-label">01 / CHOOSE A PERSPECTIVE</div>
                <div className="grid grid-cols-2 gap-2">
                  {profiles.map((p) => (
                    <button
                      className={
                        "persona-card " + (profileId === p.id ? "chosen" : "")
                      }
                      aria-pressed={profileId === p.id}
                      onClick={() => chooseProfile(p.id)}
                      key={p.id}
                    >
                      <span className="avatar" style={{ background: p.color }}>
                        {p.name
                          .split(" ")
                          .map((s) => s[0])
                          .join("")}
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.role}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="soft-card">
                  <b>{profile.name}'s mobility profile</b>
                  <p>
                    {profile.speed} m/s ·{" "}
                    {profile.stepFree ? "Avoid mapped steps" : "Walking"}
                    {profile.rest > 0
                      ? ` · rest after ${profile.restEvery} m`
                      : ""}
                  </p>
                  <small>
                    Fictional resident. Mobility parameters are illustrative
                    assumptions.
                  </small>
                </div>
                <button
                  className="primary full"
                  onClick={() => setTab("routine")}
                >
                  Build this resident’s day →
                </button>
              </>
            )}
            {tab === "routine" && (
              <>
                <div className="resident-summary">
                  <span
                    className="avatar small"
                    style={{ background: profile.color }}
                  >
                    {profile.name[0]}
                  </span>
                  <div>
                    <strong>{profile.name}'s day</strong>
                    <small>{profile.role}</small>
                  </div>
                  <button onClick={() => setTab("resident")}>Change</button>
                </div>
                <button
                  className="text-button"
                  onClick={() => resetRoutineFor(profileId)}
                >
                  ↺ Reset to {profile.name}'s default routine
                </button>
                <div className="section-label">01 / START AT HOME</div>
                <label className="field-label">
                  Home location
                  <select
                    value={home.id}
                    onChange={(e) =>
                      setHome(homes.find((h) => h.id === e.target.value)!)
                    }
                  >
                    {homes.map((h) => (
                      <option value={h.id} key={h.id}>
                        {h.name}
                      </option>
                    ))}
                    {home.id === "custom-home" && (
                      <option value={home.id}>{home.name}</option>
                    )}
                  </select>
                </label>
                <button
                  className="text-button"
                  onClick={() => {
                    setPinHome(!pinHome);
                    setMobile(false);
                  }}
                >
                  ⌖ {pinHome ? "Cancel placing home" : "Choose home on the map"}
                </button>
                <div className="two-fields">
                  <label className="field-label">
                    Depart at
                    <input
                      type="time"
                      value={departure}
                      onChange={(e) => setDeparture(e.target.value || "08:00")}
                    />
                  </label>
                  <label className="field-label">
                    Time budget (min)
                    <input
                      type="number"
                      min="10"
                      max="1440"
                      value={budget}
                      onChange={(e) =>
                        setBudget(
                          Math.max(10, Math.min(1440, Number(e.target.value))),
                        )
                      }
                    />
                  </label>
                </div>
                <div className="section-label">
                  02 / CONNECT YOUR STOPS <span>{stops.length}/6</span>
                </div>
                <div className="stop-list">
                  {stops.map((s, i) => {
                    const p =
                      s.placeId === "return-home"
                        ? home
                        : places.find((p) => p.id === s.placeId)!;
                    return (
                      <div className="stop-card" key={i}>
                        <div className="stop-top">
                          <span className="stop-number">{i + 1}</span>
                          <select
                            aria-label={`Destination ${i + 1}`}
                            value={s.placeId}
                            onChange={(e) =>
                              update(i, { placeId: e.target.value })
                            }
                          >
                            <option value="return-home">
                              Return to selected home
                            </option>
                            {places.map((p) => (
                              <option value={p.id} key={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <button
                            aria-label={`Remove stop ${i + 1}`}
                            onClick={() =>
                              setStops((a) => a.filter((_, j) => i !== j))
                            }
                          >
                            ×
                          </button>
                        </div>
                        <div className="stop-settings">
                          <select
                            aria-label={`Travel mode to stop ${i + 1}`}
                            value={s.mode}
                            onChange={(e) =>
                              update(i, {
                                mode: e.target.value as Stop["mode"],
                              })
                            }
                          >
                            <option value="walk">↗ Walk / wheel</option>
                            <option value="drive">▰ Drive + park</option>
                          </select>
                          <label>
                            <input
                              aria-label={`Activity minutes at stop ${i + 1}`}
                              type="number"
                              min="0"
                              max="240"
                              value={s.dwell}
                              onChange={(e) =>
                                update(i, {
                                  dwell: Math.max(
                                    0,
                                    Math.min(240, Number(e.target.value)),
                                  ),
                                })
                              }
                            />{" "}
                            min stay
                          </label>
                          <button
                            disabled={i === 0}
                            aria-label={`Move stop ${i + 1} earlier`}
                            onClick={() =>
                              setStops((a) => {
                                const b = [...a];
                                [b[i - 1], b[i]] = [b[i]!, b[i - 1]!];
                                return b;
                              })
                            }
                          >
                            ↑
                          </button>
                          <button
                            disabled={i === stops.length - 1}
                            aria-label={`Move stop ${i + 1} later`}
                            onClick={() =>
                              setStops((a) => {
                                const b = [...a];
                                [b[i + 1], b[i]] = [b[i]!, b[i + 1]!];
                                return b;
                              })
                            }
                          >
                            ↓
                          </button>
                        </div>
                        {s.mode === "drive" && (
                          <label className="parking-select">
                            P &nbsp; Park here, then walk / wheel
                            <select
                              aria-label={`Parking for stop ${i + 1}`}
                              value={s.parkingId}
                              onChange={(e) =>
                                update(i, { parkingId: e.target.value })
                              }
                            >
                              {parking.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <small>
                              {
                                parking.find((p) => p.id === s.parkingId)
                                  ?.source
                              }
                            </small>
                          </label>
                        )}
                        <button
                          className="locate-stop"
                          onClick={() => {
                            setSelected(p);
                            setMobile(false);
                          }}
                        >
                          Locate on map ↗
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  className="add-stop"
                  disabled={stops.length >= 6}
                  onClick={() => add(park)}
                >
                  + Add a destination
                </button>
                {stops.some((s) => s.mode === "drive") && (
                  <label className="field-label parking-assumption">
                    Assumed parking search (min / visit)
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={searchMin}
                      onChange={(e) =>
                        setSearchMin(
                          Math.max(0, Math.min(30, Number(e.target.value))),
                        )
                      }
                    />
                    <small>
                      Plus 1 min to park. Fees, hours, availability and
                      accessible bays are unverified.
                    </small>
                  </label>
                )}
                <div className="soft-card">
                  <b>Your car stays where you park it.</b>
                  <p>
                    Driving includes returning to the car and walking from the
                    next parking location.
                  </p>
                </div>
              </>
            )}
            {tab === "design" && (
              <>
                <div className="section-label">03 / TRY A BETTER EVERYDAY</div>
                <p className="muted">
                  Changes apply to the marked locations. Results depend on your
                  route.
                </p>
                {options.map((o) => (
                  <button
                    className={
                      "design-card " + (active.includes(o.id) ? "chosen" : "")
                    }
                    key={o.id}
                    onClick={() => toggle(o.id)}
                    role="switch"
                    aria-checked={active.includes(o.id)}
                  >
                    <div>
                      <b>{o.name}</b>
                      <span className="switch" />
                    </div>
                    <p>{o.description}</p>
                    <small>
                      RM {o.cost.toLocaleString()} · illustrative capital cost
                    </small>
                  </button>
                ))}
                <button
                  className="primary full"
                  onClick={() => setView("compare")}
                >
                  See who benefits →
                </button>
                <button className="text-button" onClick={() => setActive([])}>
                  Reset all changes
                </button>
              </>
            )}
            {/* <details className="township-context">
              <summary>About this township</summary>
              {
                <div className="township-photo">
                  <img
                    src="https://simedarbyproperty.com/bandar-bukit-raja/images/slide2.jpg"
                    alt="Bandar Bukit Raja township from Sime Darby Property"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div>
                    <span>GET TO KNOW THE TOWNSHIP</span>
                    <a
                      href="https://simedarbyproperty.com/bandar-bukit-raja/index.html"
                      target="_blank"
                      rel="noreferrer"
                    >
                      A closer look at Bandar Bukit Raja ↗
                    </a>
                    <small>
                      Imagery · Sime Darby Property
                      <br />
                      Context only; not route-accessibility evidence
                    </small>
                  </div>
                </div>
              }
              <div className="map-legend">
                <span>
                  <i className="walk-line" /> Walk / wheel
                </span>
                <span>
                  <i className="drive-line" /> Drive
                </span>
                <span>▧ Study boundary</span>
              </div>
            </details> */}
          </div>
          {/* <div className="sidebar-footer">
            <span className="live-dot" /> {network.ways.length.toLocaleString()}{" "}
            mapped ways <span>OSM · {network.date}</span>
          </div> */}
        </aside>
        <section className="map-workspace" aria-label="Township simulation">
          <Map
            home={home}
            result={result}
            baseline={baseline}
            compare={compare}
            active={active}
            selected={selected}
            onSelect={(p) => {
              setSelected(p);
              if (window.matchMedia("(max-width: 760px)").matches)
                setMobile(true);
            }}
            onHome={setPinnedHome}
            pinHome={pinHome}
            showParking={parkingVisible}
            progress={progress}
            precinct={showPrecinct ? precinct.perHome : null}
            budget={budget}
          />
          <div className="map-top" style={{ justifyContent: "flex-end" }}>
            <div className="map-tools map-shadow">
              <label>
                <input
                  type="checkbox"
                  checked={parkingVisible}
                  onChange={(e) => setParkingVisible(e.target.checked)}
                />{" "}
                Parking
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={compare}
                  onChange={(e) => setCompare(e.target.checked)}
                />{" "}
                Before / after
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showPrecinct}
                  onChange={(e) => setShowPrecinct(e.target.checked)}
                />{" "}
                Precinct dots
              </label>
            </div>
          </div>
          <div className="map-search map-shadow">
            <input
              aria-label="Search mapped destinations"
              placeholder="Search a school, shop or place…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <div className="search-results">
                {filtered.length ? (
                  filtered.slice(0, 8).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelected(p);
                        setSearch("");
                        if (window.matchMedia("(max-width: 760px)").matches)
                          setMobile(true);
                      }}
                    >
                      {p.name}
                      <small>{p.kind.replaceAll("_", " ")}</small>
                    </button>
                  ))
                ) : (
                  <p>No mapped places match.</p>
                )}
              </div>
            )}
          </div>
          <div className="map-legend map-shadow">
            <span>
              <i className="walk-line" /> Walk / wheel
            </span>
            <span>
              <i className="drive-line" /> Drive
            </span>
            <span>▧ Study boundary</span>
          </div>
          {pinHome && (
            <div className="pin-instruction" role="status">
              Click within the dashed boundary to place your home.
            </div>
          )}
          <div
            className={
              "journey-dock " + (journeyExpanded ? "expanded" : "collapsed")
            }
          >
            <div className="dock-top">
              <div>
                <span className="eyebrow">
                  {profile.name.toUpperCase()}’S DAY
                </span>
                <h3>
                  {result.error
                    ? "Journey needs attention"
                    : `${fmt(result.minutes)} min · ${stops.length} stops · ${fmt(result.walkM / 1000)} km walk / wheel`}
                </h3>
              </div>
              <button
                className="play-button"
                disabled={!!result.error || !stops.length}
                onClick={() => {
                  if (progress >= 1) setProgress(0);
                  if (
                    window.matchMedia("(prefers-reduced-motion: reduce)")
                      .matches
                  ) {
                    setProgress((p) => Math.min(1, p + 0.2));
                    return;
                  }
                  setPlaying(!playing);
                }}
              >
                {playing ? "Ⅱ Pause" : "▶ Play route"}
              </button>
              <button
                className="journey-toggle primary"
                aria-expanded={journeyExpanded}
                aria-controls="journey-details"
                onClick={() => setJourneyExpanded((v) => !v)}
              >
                {journeyExpanded ? "Hide details ↓" : "Details ↑"}
              </button>
            </div>
            <div id="journey-details" hidden={!journeyExpanded}>
              {result.error ? (
                <p className="error-message" role="alert">
                  {result.error} Complete-day totals are unavailable.
                </p>
              ) : (
                <>
                  <div className="metric-grid" aria-live="polite">
                    <div>
                      <strong>
                        {fmt(result.minutes)}
                        <small> min</small>
                      </strong>
                      <span>Total elapsed</span>
                    </div>
                    <div>
                      <strong>
                        {fmt(result.walkM / 1000)}
                        <small> km</small>
                      </strong>
                      <span>Walk / wheel</span>
                    </div>
                    <div>
                      <strong>
                        {fmt(result.wait)}
                        <small> min</small>
                      </strong>
                      <span>Wait + parking</span>
                    </div>
                    <div>
                      <strong>{result.barriers}</strong>
                      <span>Assumed rest barriers</span>
                    </div>
                    <div>
                      <strong>
                        {result.walkM > 0
                          ? Math.round(
                              (result.shadedWalkM / result.walkM) * 100,
                            )
                          : 0}
                        <small>%</small>
                      </strong>
                      <span>Route shaded (assumed)</span>
                    </div>
                  </div>
                  <div className="time-verdict">
                    <span className={result.minutes <= budget ? "good" : "bad"}>
                      {result.minutes <= budget ? "✓ Within" : "! Over"}{" "}
                      {budget}-minute budget · finishes {arrival()}
                    </span>
                    {active.length > 0 && (
                      <b>
                        {saved >= 0
                          ? `${fmt(saved)} min returned`
                          : `${fmt(-saved)} min added`}
                      </b>
                    )}
                  </div>
                </>
              )}
              <input
                className="timeline"
                aria-label="Route playback progress"
                type="range"
                min="0"
                max="1"
                step="0.005"
                value={progress}
                onChange={(e) => {
                  setPlaying(false);
                  setProgress(Number(e.target.value));
                }}
              />
              <div className="dock-foot">
                <span>
                  {result.parkingVisits} parking visits ·{" "}
                  {Math.round(result.returnM)} m returning to car
                </span>
                <button onClick={() => dialog.current?.showModal()}>
                  How is this calculated?
                </button>
              </div>
              <small className="route-disclaimer">
                Approximate building access. Step-free access, seating and
                opening hours unverified. Playback shows travel only.
              </small>
            </div>
          </div>
        </section>
      </main>
      <button className="mobile-controls" onClick={() => setMobile(!mobile)}>
        {mobile ? "Close controls ↓" : "Edit resident & routine ↑"}
      </button>
      {view !== "explore" && (
        <div className="workspace-overlay">
          <div className="overlay-header">
            <div>
              <span className="eyebrow">
                {view === "jury"
                  ? "RESIDENT DESIGN JURY"
                  : "TIME RETURNED BY DESIGN"}
              </span>
              <h2>
                {view === "jury"
                  ? "A better place starts with a say."
                  : "Who gets their time back?"}
              </h2>
            </div>
            <button onClick={() => setView("explore")}>Back to map ↗</button>
          </div>
          {view === "compare" ? (
            <>
              <p>
                Same home, four mobility profiles — each on their own
                illustrative default routine (shown on the card). Precinct
                impact below replays the active profile’s routine from every
                candidate home.
              </p>
              <div className="design-chips">
                {options.map((o) => (
                  <button
                    aria-pressed={active.includes(o.id)}
                    className={active.includes(o.id) ? "chosen" : ""}
                    key={o.id}
                    onClick={() => toggle(o.id)}
                  >
                    {active.includes(o.id) ? "✓ " : "+ "}
                    {o.name}
                  </button>
                ))}
              </div>
              <div className="comparison-grid">
                {comparisons.map(({ p, stops: perStops, before, after }) => (
                  <article className="comparison-card" key={p.id}>
                    <span className="avatar" style={{ background: p.color }}>
                      {p.name[0]}
                    </span>
                    <h3>{p.name}</h3>
                    <p>{p.role}</p>
                    <small style={{ display: "block", margin: "4px 0 6px" }}>
                      {perStops
                        .map((s) =>
                          s.placeId === "return-home"
                            ? "home"
                            : (places.find((pl) => pl.id === s.placeId)
                                ?.name || "?"),
                        )
                        .join(" → ")}{" "}
                      · depart {p.defaultDeparture}
                    </small>
                    {before.error || after.error ? (
                      <strong>Route incomplete</strong>
                    ) : (
                      <>
                        <strong
                          className={
                            before.minutes >= after.minutes ? "good" : "bad"
                          }
                        >
                          {fmt(Math.abs(before.minutes - after.minutes))}{" "}
                          <small>
                            min{" "}
                            {before.minutes >= after.minutes
                              ? "saved"
                              : "added"}
                          </small>
                        </strong>
                        <p>
                          {fmt(before.minutes)} → {fmt(after.minutes)} min total
                        </p>
                        <small>
                          {before.barriers} → {after.barriers} assumed rest
                          barriers
                        </small>
                      </>
                    )}
                  </article>
                ))}
              </div>
              <div className="soft-card">
                <b>Trade-offs stay visible.</b>
                <p>
                  {comparisons.some(
                    (c) =>
                      !c.after.error &&
                      c.after.minutes > c.before.minutes + 0.1,
                  )
                    ? "At least one resident loses time. Review the affected profile before choosing this design."
                    : active.length
                      ? "No modelled time disadvantage on this routine. This does not establish universal benefit."
                      : "Select a design change to see benefits and trade-offs."}
                </p>
              </div>
              <div className="soft-card" aria-live="polite">
                <b>
                  Precinct impact · {profile.name}’s routine from{" "}
                  {homeCandidates.length} candidate homes
                </b>
                <p>
                  Within a {budget}-minute budget:{" "}
                  <strong>
                    {Math.round(precinct.passRateBefore * 100)}% → {Math.round(
                      precinct.passRateAfter * 100,
                    )}%
                  </strong>{" "}
                  of homes finish on time (
                  <span
                    className={
                      precinct.passRateAfter >= precinct.passRateBefore
                        ? "good"
                        : "bad"
                    }
                  >
                    {precinct.passRateAfter >= precinct.passRateBefore
                      ? "+"
                      : ""}
                    {Math.round(
                      (precinct.passRateAfter - precinct.passRateBefore) * 100,
                    )}
                    pp
                  </span>
                  ). Median journey:{" "}
                  <strong>
                    {Number.isFinite(precinct.medianBefore)
                      ? fmt(precinct.medianBefore)
                      : "–"}{" "}
                    →{" "}
                    {Number.isFinite(precinct.medianAfter)
                      ? fmt(precinct.medianAfter)
                      : "–"}{" "}
                    min
                  </strong>
                  . Routes complete for {precinct.completeHomes}/
                  {homeCandidates.length} homes (others sit in a disconnected
                  OSM cluster).
                </p>
                <label className="field-label">
                  Time budget (min)
                  <input
                    type="number"
                    min={10}
                    max={1440}
                    value={budget}
                    onChange={(e) =>
                      setBudget(
                        Math.max(10, Math.min(1440, Number(e.target.value))),
                      )
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showPrecinct}
                    onChange={(e) => setShowPrecinct(e.target.checked)}
                  />{" "}
                  Plot pass / fail dots on the map
                </label>
                <small>
                  Candidate homes = every 7th OSM residential-road node in the
                  study bbox (illustrative sample).
                </small>
              </div>
              <details>
                <summary>Inspect the selected resident’s journey</summary>
                {result.segments.map((s, i) => (
                  <p key={i}>
                    {s.label}: {Math.round(s.route.distance)} m ·{" "}
                    {fmt(s.minutes)} min ({s.mode})
                  </p>
                ))}
              </details>
            </>
          ) : (
            <>
              <p>
                Compare one proposal at a time on your routine. Feedback is
                saved on this device and shared anonymously with the
                township planning team; no sample votes.
              </p>
              <div className="jury-table-wrap">
                <table className="jury-table">
                  <thead>
                    <tr>
                      <th>Proposal</th>
                      <th>Net time saved¹</th>
                      <th>Rest barriers removed¹</th>
                      <th>Cost assumption</th>
                      <th>Preference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impacts.map(({ o, rows }) => {
                      const complete = rows.every(
                        (r) => !r.a.error && !r.b.error,
                      );
                      return (
                        <tr key={o.id}>
                          <td>
                            <b>{o.name}</b>
                          </td>
                          <td>
                            {complete
                              ? fmt(
                                  rows.reduce(
                                    (n, r) => n + r.b.minutes - r.a.minutes,
                                    0,
                                  ),
                                ) + " min"
                              : "Incomplete routes"}
                          </td>
                          <td>
                            {complete
                              ? rows.reduce(
                                  (n, r) => n + r.b.barriers - r.a.barriers,
                                  0,
                                )
                              : "—"}
                          </td>
                          <td>RM {o.cost.toLocaleString()}</td>
                          <td>
                            <button
                              className={voted === o.id ? "chosen" : ""}
                              onClick={() => vote(o.id)}
                            >
                              {voted === o.id ? "✓ Your choice" : "Choose"} ·{" "}
                              {votes[o.id] || 0}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <small>
                ¹ Sum across four fictional profiles on this routine. Rest
                barriers are assumptions, not a verified accessibility score.
                One editable preference per browser.
              </small>
              <div className="suggestion-layout">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!suggestion.trim()) return;
                    const next = [
                      ...suggestions,
                      {
                        text: suggestion.trim(),
                        place: selected?.name || "Study area",
                      },
                    ];
                    setSuggestions(next);
                    persist(votes, next, voted);
                    void submitSuggestion({
                      place: selected?.name || "Study area",
                      text: suggestion,
                    }).then((r) => {
                      if (r === "sent")
                        setNotice("Thank you. Your suggestion reached the planning team.");
                      else if (r === "queued")
                        setNotice("Saved on this device. It will be shared when you are back online.");
                    });
                    setSuggestion("");
                  }}
                >
                  <h3>What would make your day easier?</h3>
                  <label className="field-label">
                    Location
                    <select
                      value={selected?.id || ""}
                      onChange={(e) =>
                        setSelected(
                          places.find((p) => p.id === e.target.value) || null,
                        )
                      }
                    >
                      <option value="">Whole study area</option>
                      {places.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    Your suggestion
                    <textarea
                      required
                      maxLength={600}
                      value={suggestion}
                      onChange={(e) => setSuggestion(e.target.value)}
                      placeholder="A shaded rest stop between home and the shops…"
                    />
                  </label>
                  <button className="primary" type="submit">
                    Save suggestion
                  </button>
                </form>
                <div>
                  <h3>Resident suggestions</h3>
                  {suggestions.length ? (
                    suggestions.map((s, i) => (
                      <article className="soft-card" key={i}>
                        <small>{s.place} · not simulated</small>
                        <p>{s.text}</p>
                      </article>
                    ))
                  ) : (
                    <p>No suggestions yet. Add the first observation.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      <dialog ref={dialog} className="assumptions-modal">
        <button className="close-card" onClick={() => dialog.current?.close()}>
          Close ×
        </button>
        <span className="eyebrow">THE EVIDENCE BEHIND THE MAP</span>
        <h2>
          Real geography.
          <br />
          Honest assumptions.
        </h2>
        <p>
          Independent prototype based on Bandar Bukit Raja. Not an official Sime
          Darby Property assessment.
        </p>
        <h3>Mapped information</h3>
        <p>
          OpenStreetMap roads, paths, places and parking downloaded{" "}
          {network.date}. Coverage: 3.080–3.105 N, 101.415–101.445 E. The dashed
          rectangle is our study area, not the township boundary.
        </p>
        <h3>Illustrative assumptions</h3>
        <p>
          Driving: 22 km/h at 07:00–09:00 and 16:00–19:00; 30 km/h otherwise.
          Parking search is user-set, plus 1 minute to park. School queues: 7
          minutes. School-area crossing wait: 45 seconds. Activity time is
          editable and included in elapsed time.
        </p>
        <p>
          Rest burden assumes unavailable seating on untreated sections.
          Proposed seating changes rest burden within 500 m of BBR Sales Gallery
          Park. These are scenario assumptions, not observations of missing
          infrastructure.
        </p>
        <h3>Unknowns are not guarantees</h3>
        <p>
          Mapped steps and restricted paths are excluded where applicable.
          Untagged surfaces, kerbs and ramps remain unverified. Building and
          parking access uses approximate connectors up to 350 m, not surveyed
          paths. Traffic, parking occupancy, opening hours, fees and accessible
          bays are not live. Driving respects mapped one-way roads but does not
          yet model turn restrictions.
        </p>
        <p>
          Photos provide township context, not verification of individual stops.
          Proposed parking is explicitly labelled. Cycling and public transport
          are not yet modelled.
        </p>
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors · ODbL ↗
        </a>
        <br />
        <a
          href="https://simedarbyproperty.com/bandar-bukit-raja/index.html"
          target="_blank"
          rel="noreferrer"
        >
          Township information and imagery · Sime Darby Property ↗
        </a>
      </dialog>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
