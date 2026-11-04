"use client";

// Phase 0 of the Recipes plan: the same screens drawn in each look direction, to pick a name, color and style.

import { useState, type CSSProperties, type ReactNode } from "react";
import { LOOK_FONTS } from "./fonts";
import { LOOKS, type Look } from "./looks";
import { BANANA_BREAD, CARD_RECIPES, usesOf, type LookRecipe } from "./featured";
import { layoutTable } from "@/lib/recipe-table";

/** The accent when it is text: light accents like butter yellow use a deeper shade to stay readable. */
const textAccent = (look: Look) => look.color.accentText ?? look.color.accent;

const HUES: Record<string, string> = { "banana-bread": "#c98500", chicken: "#d95926", soup: "#e34948" };
const minutes = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} hr${n % 60 ? ` ${n % 60} min` : ""}` : `${n} min`);
/** "3/4 cup (150 g) brown sugar" without its amount, for a split use like "2 tbsp brown sugar". */
const itemName = (text: string) => text.replace(/^[\d\s/.]+(cups?|tbsp|tsp|lb|oz)?\s*(\([^)]*\))?\s*/i, "");

export function LooksLab() {
  const [id, setId] = useState<string>("compare");
  const look = LOOKS.find((l) => l.id === id);
  return (
    <div className={LOOK_FONTS} style={{ minHeight: "100vh", background: look?.pageBackground ?? "#f5f4ef" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", flexWrap: "wrap", gap: 8, padding: "12px 16px", background: "rgba(20,20,20,.86)", backdropFilter: "blur(6px)" }}>
        {[{ id: "compare", name: "Compare all" }, ...LOOKS].map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => {
              setId(l.id);
              window.scrollTo({ top: 0 });
            }}
            style={{ font: "500 14px system-ui", padding: "6px 14px", borderRadius: 999, border: 0, cursor: "pointer", background: id === l.id ? "#fff" : "rgba(255,255,255,.14)", color: id === l.id ? "#111" : "#fff" }}
          >
            {l.name}
          </button>
        ))}
      </div>
      {look ? <LookPage look={look} /> : <Compare onPick={setId} />}
    </div>
  );
}

function Compare({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div style={{ padding: "24px 16px", maxWidth: 1200, margin: "0 auto" }}>
      <p style={{ font: "15px system-ui", color: "#444", margin: "0 0 16px" }}>The same recipe card in every look. Pick one to see every screen in it.</p>
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {LOOKS.map((look) => (
          <button key={look.id} type="button" onClick={() => onPick(look.id)} style={{ textAlign: "left", border: 0, padding: 16, borderRadius: 14, cursor: "pointer", background: look.pageBackground }}>
            <div style={{ fontFamily: look.fonts.display, ...look.heading, fontSize: 24, color: look.color.ink }}>{look.name}</div>
            <div style={{ fontFamily: look.fonts.body, fontSize: 12.5, color: look.color.muted, margin: "2px 0 12px" }}>The section would be called {look.appName}</div>
            <RecipeCard look={look} recipe={BANANA_BREAD} />
            <div style={{ fontFamily: look.fonts.body, fontSize: 13, color: look.color.muted, marginTop: 10 }}>{look.feel}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function LookPage({ look }: { look: Look }) {
  const c = look.color;
  return (
    <div style={{ color: c.ink, fontFamily: look.fonts.body, padding: "20px 16px 60px", maxWidth: 1200, margin: "0 auto", colorScheme: look.dark ? "dark" : "light" }}>
      <Spec look={look} />
      {look.band && <div aria-hidden style={{ height: 16, marginTop: 20, borderRadius: Math.min(look.radius, 8), background: look.band }} />}
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, margin: "24px 0 8px" }}>
        <div style={{ fontFamily: look.fonts.display, ...look.heading, fontSize: 40, lineHeight: 1 }}>{look.appName}</div>
        <nav style={{ display: "flex", gap: 6, fontFamily: look.fonts.detail, fontSize: 14 }}>
          {["Recipes", "Meals", "Menus"].map((n, i) => (
            <span key={n} style={{ padding: "5px 12px", borderRadius: look.radius ? 999 : 0, background: i === 0 ? c.accent : "transparent", color: i === 0 ? c.onAccent : c.muted }}>
              {n}
            </span>
          ))}
        </nav>
        <div style={{ flex: "1 1 220px", maxWidth: 360, marginLeft: "auto", padding: "9px 14px", borderRadius: Math.min(look.radius, 12) || 0, border: `1.5px solid ${c.rule}`, background: c.surface, color: c.muted, fontSize: 14 }}>
          Search recipes, tags, ingredients
        </div>
      </header>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0 16px", fontFamily: look.fonts.detail, fontSize: 13 }}>
        {["Favorites", "Not tried yet", "4 stars and up", "Mine", "Baking", "Dinner", "Fried chicken"].map((t, i) => (
          <span key={t} style={{ padding: "4px 11px", borderRadius: look.radius ? 999 : 0, border: `1.5px solid ${i === 1 ? c.accent : c.rule}`, color: i === 1 ? textAccent(look) : c.ink, background: c.surface }}>
            {t}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {CARD_RECIPES.map((r) => (
          <RecipeCard key={r.id} look={look} recipe={r} />
        ))}
      </div>
      <Label look={look}>The recipe page</Label>
      <RecipePage look={look} recipe={BANANA_BREAD} />
      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
        <div>
          <Label look={look}>Cook mode on a phone</Label>
          <CookPhone look={look} recipe={BANANA_BREAD} />
        </div>
        <div>
          <Label look={look}>Logging a cook</Label>
          <LogEntry look={look} />
        </div>
      </div>
    </div>
  );
}

function Label({ look, children }: { look: Look; children: ReactNode }) {
  return <div style={{ fontFamily: look.fonts.detail, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: look.color.muted, margin: "40px 0 12px" }}>{children}</div>;
}

function Spec({ look }: { look: Look }) {
  const c = look.color;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", padding: 14, borderRadius: 10, background: look.dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)" }}>
      <div style={{ flex: "1 1 280px" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{look.name}</div>
        <div style={{ fontSize: 13.5, color: c.muted }}>{look.feel}</div>
        <div style={{ fontSize: 12.5, color: c.muted, marginTop: 4 }}>Type: {look.fonts.names}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[c.page, c.surface, c.ink, c.accent, c.second, c.highlight].map((hex, i) => (
          <span key={i} title={hex} style={{ width: 28, height: 28, borderRadius: 6, background: hex, border: "1px solid rgba(127,127,127,.35)" }} />
        ))}
      </div>
    </div>
  );
}

function Stars({ look, value, size = 16 }: { look: Look; value: number; size?: number }) {
  return (
    <span aria-label={`${value} of 5 stars`} style={{ position: "relative", display: "inline-block", fontFamily: "system-ui, sans-serif", fontSize: size, lineHeight: 1, letterSpacing: 1 }}>
      <span style={{ color: `color-mix(in srgb, ${look.color.muted} 30%, transparent)` }}>★★★★★</span>
      <span style={{ position: "absolute", inset: 0, width: `${(value / 5) * 100}%`, overflow: "hidden", color: look.color.star, whiteSpace: "nowrap" }}>★★★★★</span>
    </span>
  );
}

function Panel({ look, pad = 16, style, children }: { look: Look; pad?: number; style?: CSSProperties; children: ReactNode }) {
  const top = look.cardTop || look.tape;
  // Each side on its own: mixing the padding shorthand with one side breaks when the look changes.
  const sides = { paddingTop: top ? pad + 10 : pad, paddingRight: pad, paddingBottom: pad, paddingLeft: look.panel.paddingLeft ? Math.max(52, pad + 36) : pad };
  return (
    <div style={{ position: "relative", background: look.color.surface, color: look.color.ink, fontFamily: look.fonts.body, borderRadius: look.radius, ...look.panel, ...style, ...sides }}>
      {look.cardTop && <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: 0, height: 10, background: look.cardTop, borderRadius: `${look.radius}px ${look.radius}px 0 0` }} />}
      {look.tape && <div aria-hidden style={{ position: "absolute", left: "50%", top: -9, width: 96, height: 22, transform: "translateX(-50%) rotate(-3deg)", background: look.tape, boxShadow: "0 1px 2px rgba(0,0,0,.12)" }} />}
      {children}
    </div>
  );
}

function RatingLine({ look, recipe }: { look: Look; recipe: LookRecipe }) {
  const c = look.color;
  if (recipe.overall === null) return <span style={{ fontSize: 13, fontWeight: 600, color: c.second }}>Not tried yet</span>;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
      <Stars look={look} value={recipe.overall} />
      <span style={{ fontWeight: 600 }}>{recipe.overall.toFixed(1)}</span>
      <span style={{ color: c.muted }}>from {recipe.ratings.length}</span>
      {recipe.trend && <span style={{ color: recipe.trend === "up" ? c.second : textAccent(look) }}>{recipe.trend === "up" ? "↑" : "↓"}</span>}
    </span>
  );
}

function RecipeCard({ look, recipe }: { look: Look; recipe: LookRecipe }) {
  const c = look.color;
  return (
    <Panel look={look} pad={12}>
      <div aria-hidden style={{ height: 120, borderRadius: Math.max(0, look.radius - 6), background: look.picture(HUES[recipe.id] ?? c.accent), marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1, fontFamily: look.fonts.display, ...look.heading, fontSize: 21, lineHeight: 1.15 }}>{recipe.title}</div>
        <span aria-label={recipe.favorite ? "Favorite" : "Not a favorite"} style={{ color: recipe.favorite ? textAccent(look) : c.rule, fontSize: 20 }}>
          {recipe.favorite ? "♥" : "♡"}
        </span>
      </div>
      <div style={{ marginTop: 6 }}>
        <RatingLine look={look} recipe={recipe} />
      </div>
      <div style={{ fontFamily: look.fonts.detail, fontSize: 12.5, color: c.muted, marginTop: 6 }}>
        {minutes(recipe.prepMin + recipe.cookMin)} · {recipe.servings} servings{recipe.lastCooked ? ` · cooked ${recipe.lastCooked}` : ""}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
        {recipe.tags.map((t) => (
          <span key={t} style={{ fontFamily: look.fonts.detail, fontSize: 11.5, padding: "2px 8px", borderRadius: look.radius ? 999 : 0, border: `1px solid ${c.rule}`, color: c.muted }}>
            {t}
          </span>
        ))}
      </div>
    </Panel>
  );
}

function RecipePage({ look, recipe }: { look: Look; recipe: LookRecipe }) {
  const c = look.color;
  const [view, setView] = useState<"side" | "glance">("side");
  const [step, setStep] = useState<string | null>("s3");
  const [ingredient, setIngredient] = useState<string | null>(null);
  const usesIn = (id: string) => recipe.steps.find((s) => s.id === id)?.uses ?? [];
  const stepUses = (id: string) => usesIn(id).map((u) => u.ingredientId);
  const lit = {
    ingredient: (id: string) => ingredient === id || (!!step && stepUses(step).includes(id)),
    // One row of the table is one use, so a split ingredient lights only the part this step takes.
    use: (id: string, amount?: string) => ingredient === id || (!!step && usesIn(step).some((u) => u.ingredientId === id && u.amount === amount)),
    step: (id: string) => step === id || (!!ingredient && stepUses(id).includes(ingredient)),
  };
  const pick = { step: (id: string) => (setIngredient(null), setStep(step === id ? null : id)), ingredient: (id: string) => (setStep(null), setIngredient(ingredient === id ? null : id)) };
  const button = (primary: boolean): CSSProperties => ({
    fontFamily: look.fonts.detail,
    fontSize: 14,
    fontWeight: 600,
    padding: "9px 16px",
    borderRadius: look.radius ? 999 : 0,
    cursor: "pointer",
    border: `1.5px solid ${primary ? c.accent : c.rule}`,
    background: primary ? c.accent : c.surface,
    color: primary ? c.onAccent : c.ink,
    ...(look.chunky ? { boxShadow: `3px 3px 0 ${look.chunky}`, borderColor: c.ink } : {}),
  });
  return (
    <Panel look={look} pad={20}>
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "start" }}>
        <div aria-hidden style={{ minHeight: 180, height: "100%", borderRadius: Math.max(0, look.radius - 4), background: look.picture(HUES[recipe.id]!) }} />
        <div style={{ gridColumn: "span 2", minWidth: 0 }}>
          <div style={{ fontFamily: look.fonts.detail, fontSize: 12.5, color: c.muted }}>From {recipe.source}</div>
          <h1 style={{ fontFamily: look.fonts.display, ...look.heading, fontSize: "clamp(28px, 4vw, 42px)", lineHeight: 1.08, margin: "4px 0 6px" }}>{recipe.title}</h1>
          <div style={{ color: c.muted, fontSize: 15 }}>{recipe.blurb}</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 18px", marginTop: 12 }}>
            <RatingLine look={look} recipe={recipe} />
            {recipe.ratings.map((r) => (
              <span key={r.who} style={{ fontSize: 13, color: c.muted }}>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: r.color, marginRight: 5 }} />
                {r.who} {r.stars}
              </span>
            ))}
            <span style={{ fontSize: 13, color: c.muted }}>
              Cooked {recipe.cooked} times · last {recipe.lastCooked}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <button type="button" style={button(true)}>Start cooking</button>
            <button type="button" style={button(false)}>Log a cook</button>
            <button type="button" style={button(false)}>Edit</button>
          </div>
        </div>
      </div>

      <div role="tablist" style={{ display: "flex", gap: 6, margin: "24px 0 14px" }}>
        {(["side", "glance"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} style={{ ...button(view === v), padding: "6px 14px", fontSize: 13 }}>
            {v === "side" ? "Side by side" : "At a glance"}
          </button>
        ))}
        <span style={{ alignSelf: "center", fontSize: 12.5, color: c.muted, marginLeft: 6 }}>Tap a step or an ingredient to see what goes where</span>
      </div>

      {view === "side" ? (
        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", alignItems: "start" }}>
          <div>
            <div style={{ fontFamily: look.fonts.display, ...look.heading, fontSize: 22, marginBottom: 8 }}>Ingredients · {recipe.servings} servings</div>
            {recipe.ingredients.map((ing) => {
              const uses = usesOf(recipe, ing.id);
              const split = uses.filter((u) => u.amount);
              return (
                <button
                  key={ing.id}
                  type="button"
                  onClick={() => pick.ingredient(ing.id)}
                  style={{ display: "block", width: "100%", textAlign: "left", border: 0, cursor: "pointer", padding: "6px 8px", margin: "0 -8px", borderRadius: Math.min(look.radius, 8), background: lit.ingredient(ing.id) ? c.highlight : "transparent", color: c.ink, fontFamily: look.lineFont, fontSize: 15 }}
                >
                  {ing.text}
                  {split.length > 1 && (
                    <span style={{ display: "block", fontSize: 12, color: c.muted, fontFamily: look.fonts.detail }}>
                      {split.map((u) => `${u.amount} in step ${u.step}`).join(" · ")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ gridColumn: "span 2", minWidth: 0 }}>
            <div style={{ fontFamily: look.fonts.display, ...look.heading, fontSize: 22, marginBottom: 8 }}>Steps</div>
            <div style={{ fontSize: 13.5, color: c.muted, marginBottom: 8 }}>{recipe.before.join(". ")}.</div>
            {recipe.steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick.step(s.id)}
                style={{ display: "flex", gap: 12, width: "100%", textAlign: "left", border: 0, cursor: "pointer", padding: "8px 10px", margin: "0 -10px 2px", borderRadius: Math.min(look.radius, 8), background: lit.step(s.id) ? c.highlight : "transparent", color: c.ink, fontFamily: look.fonts.body, fontSize: 15.5, lineHeight: 1.5 }}
              >
                <span style={{ fontFamily: look.fonts.display, ...look.heading, color: textAccent(look), fontSize: 20, minWidth: 22, lineHeight: 1.2 }}>{i + 1}</span>
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Glance look={look} recipe={recipe} lit={lit} pick={pick} />
      )}
    </Panel>
  );
}

function Glance({ look, recipe, lit, pick }: { look: Look; recipe: LookRecipe; lit: { use: (id: string, amount?: string) => boolean; step: (id: string) => boolean }; pick: { step: (id: string) => void; ingredient: (id: string) => void } }) {
  const c = look.color;
  const table = layoutTable(recipe.ingredients, recipe.steps);
  if (!table) return <div style={{ color: c.muted }}>This recipe&apos;s steps do not form one tree yet, so the table is not available.</div>;
  const top = recipe.before.length;
  const byId = new Map(recipe.ingredients.map((i) => [i.id, i]));
  const cell: CSSProperties = { background: c.surface, padding: "6px 8px", fontSize: 13.5, display: "flex", alignItems: "center", textAlign: "left", border: 0, color: c.ink };
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: `minmax(180px, 1.6fr) repeat(${table.columns}, minmax(84px, 1fr))`, gap: 1.5, background: c.rule, border: `1.5px solid ${c.rule}`, minWidth: 180 + table.columns * 86 }}>
        {recipe.before.map((b, i) => (
          <div key={b} style={{ ...cell, justifyContent: "center", gridColumn: `1 / ${table.columns + 2}`, gridRow: i + 1, fontFamily: look.fonts.detail }}>
            {b}
          </div>
        ))}
        {table.rows.map((r, i) => {
          const ing = byId.get(r.ingredientId)!;
          return (
            <button key={i} type="button" onClick={() => pick.ingredient(ing.id)} style={{ ...cell, cursor: "pointer", gridColumn: 1, gridRow: top + i + 1, fontFamily: look.lineFont, background: lit.use(ing.id, r.amount) ? c.highlight : c.surface }}>
              {r.amount ? `${r.amount} ${itemName(ing.text)}` : ing.text}
            </button>
          );
        })}
        {table.cells.map((t, i) => {
          const s = t.stepId ? recipe.steps.find((x) => x.id === t.stepId) : null;
          const style: CSSProperties = { ...cell, justifyContent: "center", textAlign: "center", gridRow: `${top + t.row + 1} / ${top + t.rowEnd + 1}`, gridColumn: `${t.col + 1} / ${t.colEnd + 1}` };
          return s ? (
            <button key={i} type="button" title={s.text} onClick={() => pick.step(s.id)} style={{ ...style, cursor: "pointer", fontFamily: look.fonts.detail, fontWeight: 600, background: lit.step(s.id) ? c.highlight : c.surface }}>
              {s.label}
            </button>
          ) : (
            <div key={i} style={style} />
          );
        })}
      </div>
    </div>
  );
}

function CookPhone({ look, recipe }: { look: Look; recipe: LookRecipe }) {
  const c = look.color;
  const [i, setI] = useState(1);
  const step = recipe.steps[i]!;
  const next = recipe.steps[i + 1];
  const byId = new Map(recipe.ingredients.map((x) => [x.id, x]));
  const meanwhile = /^(meanwhile|while)\b/i.test(next?.text ?? "");
  const btn = (primary: boolean): CSSProperties => ({ flex: primary ? 2 : 1, padding: "14px 0", borderRadius: Math.min(look.radius, 14), border: `1.5px solid ${primary ? c.accent : c.rule}`, background: primary ? c.accent : "transparent", color: primary ? c.onAccent : c.ink, fontFamily: look.fonts.detail, fontWeight: 700, fontSize: 15, cursor: "pointer" });
  return (
    <div style={{ maxWidth: 380, margin: "0 auto", borderRadius: 36, padding: 10, background: "#0d0d0d" }}>
      <div style={{ borderRadius: 28, overflow: "hidden", background: look.dark ? c.page : c.surface, color: c.ink, minHeight: 640, display: "flex", flexDirection: "column" }}>
        {look.band && <div aria-hidden style={{ height: 12, background: look.band }} />}
        <div style={{ padding: "16px 18px 10px", borderBottom: `1px solid ${c.rule}` }}>
          <div style={{ fontFamily: look.fonts.display, ...look.heading, fontSize: 18 }}>{recipe.title}</div>
          <div style={{ fontSize: 12, color: c.muted }}>10 servings · screen stays on</div>
          <div style={{ height: 4, borderRadius: 2, background: c.rule, marginTop: 10 }}>
            <div style={{ height: 4, borderRadius: 2, width: `${((i + 1) / recipe.steps.length) * 100}%`, background: c.accent }} />
          </div>
        </div>
        <div style={{ flex: 1, padding: "26px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontFamily: look.fonts.detail, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: c.muted }}>
            Step {i + 1} of {recipe.steps.length}
          </div>
          <div style={{ fontFamily: look.fonts.body, fontSize: 25, lineHeight: 1.3, fontWeight: 500 }}>{step.text}</div>
          {!!step.uses?.length && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {step.uses.map((u) => (
                <span key={u.ingredientId} style={{ fontFamily: look.lineFont, fontSize: 13, padding: "4px 10px", borderRadius: Math.min(look.radius, 999), background: c.highlight }}>
                  {u.amount ? `${u.amount} ${itemName(byId.get(u.ingredientId)!.text)}` : byId.get(u.ingredientId)!.text}
                </span>
              ))}
            </div>
          )}
          {/(\d+)\s*(to\s*\d+\s*)?minutes?/.test(step.text) && (
            <button type="button" style={{ alignSelf: "flex-start", ...btn(false), flex: "none", padding: "10px 16px" }}>
              ⏱ Start timer
            </button>
          )}
          {next && (
            <div style={{ marginTop: "auto", padding: 12, borderRadius: Math.min(look.radius, 12), border: `1.5px dashed ${c.rule}` }}>
              <div style={{ fontFamily: look.fonts.detail, fontSize: 11.5, letterSpacing: 1.2, textTransform: "uppercase", color: meanwhile ? c.second : c.muted }}>{meanwhile ? "Up next, while this one waits" : "Up next"}</div>
              <div style={{ fontSize: 14.5, marginTop: 3, color: c.muted }}>{next.text}</div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "8px 14px" }}>
          <span style={{ fontFamily: look.fonts.detail, fontSize: 13, padding: "5px 10px", borderRadius: 999, border: `1.5px solid ${c.accent}`, color: textAccent(look) }}>⏱ Melt · 3:12</span>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "10px 14px 18px" }}>
          <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} style={{ ...btn(false), opacity: i === 0 ? 0.4 : 1 }}>
            Back
          </button>
          <button type="button" onClick={() => setI(Math.min(recipe.steps.length - 1, i + 1))} style={btn(true)}>
            {next ? "Next step" : "Done cooking"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogEntry({ look }: { look: Look }) {
  const c = look.color;
  return (
    <Panel look={look}>
      <div style={{ fontFamily: look.fonts.display, ...look.heading, fontSize: 22 }}>How did it go?</div>
      <div style={{ fontSize: 13, color: c.muted, marginTop: 2 }}>Cinnamon swirl banana bread · Nov 3 · version 2</div>
      <div style={{ margin: "14px 0 10px" }}>
        <Stars look={look} value={4} size={30} />
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
        <span aria-hidden style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${c.ink}`, display: "inline-block" }} />
        Something went wrong, do not count this rating
      </label>
      <div style={{ marginTop: 12, padding: 12, minHeight: 78, borderRadius: Math.min(look.radius, 10), border: `1.5px solid ${c.rule}`, fontFamily: look.lineFont, fontSize: 14.5, color: c.ink, background: look.dark ? c.page : "transparent" }}>
        Used 4 bananas, extra moist. Swirl sank a bit, try layering thinner next time.
      </div>
      <div style={{ marginTop: 16, borderTop: `1px solid ${c.rule}`, paddingTop: 12 }}>
        <div style={{ fontFamily: look.fonts.detail, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: c.muted, marginBottom: 6 }}>History</div>
        {[
          ["Oct 28", "Bryce", 4.5, ""],
          ["Oct 12", "Lauren", 4, ""],
          ["Sep 30", "Bryce", 2, "something went wrong"],
        ].map(([d, who, stars, note]) => (
          <div key={`${d}${who}`} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, padding: "4px 0", opacity: note ? 0.6 : 1 }}>
            <span style={{ width: 56, color: c.muted }}>{d}</span>
            <span style={{ width: 60 }}>{who}</span>
            <Stars look={look} value={Number(stars)} size={14} />
            {note && <span style={{ fontSize: 12, color: c.muted }}>{note}</span>}
          </div>
        ))}
      </div>
    </Panel>
  );
}
