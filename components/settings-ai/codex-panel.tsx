"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setCloudModelsAction, setCodexEnabledAction, testConnectionAction } from "@/app/(app)/settings/ai/actions";
import { Chevron, CopyCommand, Group, ResultLine, Row, StatusDot, Switch, btn, field, useAction } from "./shared";

type Props = {
  installed: boolean;
  bin: string;
  version: string | null;
  loggedIn: boolean;
  account: string | null;
  error: string | null;
  enabled: boolean;
  overrides: { fast: string; smart: string };
};

export function CodexPanel({ installed, bin, version, loggedIn, account, error, enabled, overrides }: Props) {
  const router = useRouter();
  const toggle = useAction();
  const modelAction = useAction();
  const [open, setOpen] = useState(false);
  const [fast, setFast] = useState(overrides.fast);
  const [smart, setSmart] = useState(overrides.smart);

  return (
    <Group
      title="ChatGPT (Codex CLI)"
      footer="Uses your ChatGPT plan through OpenAI's Codex CLI, so there is no API key. Each request starts the CLI, so answers take 5 to 20 seconds."
    >
      <Row
        title="Codex CLI"
        subtitle={installed ? bin : "Not found on this Mac"}
        trailing={installed ? <span>{version}</span> : <span className="flex items-center gap-1.5"><StatusDot state="fail" />Missing</span>}
      >
        {!installed ? (
          <div className="flex flex-col gap-2 px-4 pb-3 text-[13px]">
            {error ? <p className="break-words text-[12px] text-black/45">{error}</p> : null}
            <p className="text-black/70">Install it in Terminal, then sign in with your ChatGPT account:</p>
            <CopyCommand command="npm install -g @openai/codex" />
            <CopyCommand command="codex login" />
          </div>
        ) : null}
      </Row>
      {installed ? (
        <Row
          title="ChatGPT account"
          subtitle={loggedIn ? account : "Not signed in"}
          trailing={<span className="flex items-center gap-1.5"><StatusDot state={loggedIn ? "ok" : "fail"} />{loggedIn ? "Signed in" : "Sign in needed"}</span>}
        >
          {!loggedIn ? (
            <div className="flex flex-col gap-2 px-4 pb-3 text-[13px]">
              <p className="text-black/70">Run this in Terminal and choose &quot;Sign in with ChatGPT&quot;, then check again:</p>
              <CopyCommand command="codex login" />
            </div>
          ) : null}
        </Row>
      ) : null}
      <Row
        title="Use ChatGPT"
        subtitle={enabled ? "On: Placed can send requests through Codex" : "Off"}
        trailing={
          <Switch
            label="Use ChatGPT"
            checked={enabled}
            disabled={(!installed && !enabled) || toggle.pending}
            onChange={(on) =>
              toggle.run(async () => {
                const r = await setCodexEnabledAction(on);
                router.refresh();
                if (r.ok && on) {
                  const t = await testConnectionAction("codex", "smart");
                  router.refresh();
                  return t;
                }
                return r;
              })
            }
          />
        }
      >
        {toggle.pending || toggle.result ? (
          <div className="px-4 pb-3">{toggle.pending ? <p className="text-[13px] text-black/50">Testing ChatGPT…</p> : <ResultLine result={toggle.result} />}</div>
        ) : null}
      </Row>
      <Row title="Models" subtitle={overrides.smart || overrides.fast ? `${overrides.smart || "default"} · ${overrides.fast || "default"}` : "Codex default"} trailing={<button type="button" className={btn} onClick={() => setOpen(!open)} aria-expanded={open}>Edit<Chevron open={open} /></button>}>
        {open ? (
          <form
            className="flex flex-col gap-2 px-4 pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              modelAction.run(async () => {
                const r = await setCloudModelsAction("codex", fast, smart);
                if (!r.ok || !enabled) return r;
                const t = await testConnectionAction("codex", "smart");
                router.refresh();
                return t;
              });
            }}
          >
            <p className="text-[12px] text-black/50">Leave empty for the Codex CLI&apos;s default model.</p>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-black/70">
              CV review &amp; writing
              <input value={smart} onChange={(e) => setSmart(e.target.value)} placeholder="Codex default" className={`${field} font-mono`} spellCheck={false} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-black/70">
              Quick tasks
              <input value={fast} onChange={(e) => setFast(e.target.value)} placeholder="Codex default" className={`${field} font-mono`} spellCheck={false} />
            </label>
            <button type="submit" className={`${btn} self-start`} disabled={modelAction.pending}>
              {modelAction.pending ? "Saving and testing…" : "Save"}
            </button>
            <ResultLine result={modelAction.result} />
          </form>
        ) : null}
      </Row>
    </Group>
  );
}
