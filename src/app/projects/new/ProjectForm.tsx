"use client";

import { useActionState } from "react";
import { createProjectAction, type CreateProjectState } from "../actions";

interface Props {
  userId: string;
  services: { name: string; label: string }[];
}

export function ProjectForm({ userId, services }: Props) {
  const [state, action, pending] = useActionState<CreateProjectState, FormData>(createProjectAction, {});
  const fieldError = (name: string) => state.fieldErrors?.[name]?.map((e) => <span key={e} className="field-error">{e}</span>);

  return (
    <form action={action} className="form">
      {state.error && (
        <div className="alert" role="alert">
          <strong>{state.error}</strong>
          {state.violations && (
            <ul>
              {state.violations.map((v) => (
                <li key={v.code}>
                  {v.message} <code>{v.code}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label>
        Name
        <input name="name" required minLength={3} maxLength={120} />
        {fieldError("name")}
      </label>

      <label>
        Description
        <textarea name="description" rows={2} />
      </label>

      <label>
        Data classification
        <select name="dataClassification" defaultValue="internal">
          <option value="public">Public</option>
          <option value="internal">Internal</option>
          <option value="sensitive">Sensitive</option>
        </select>
        {fieldError("dataClassification")}
      </label>

      <label>
        Ethics approval ID <span className="muted">(required for sensitive data)</span>
        <input name="ethicsApprovalId" />
      </label>

      <fieldset>
        <legend>Services</legend>
        <div className="checks">
          {services.map((s) => (
            <label key={s.name} className="check">
              <input type="checkbox" name="services" value={s.name} defaultChecked /> {s.label}
            </label>
          ))}
        </div>
        {fieldError("services")}
      </fieldset>

      <label>
        Other members <span className="muted">(one user ID per line; add &quot;lead&quot; after the ID for a co-lead. You ({userId}) lead.)</span>
        <textarea name="members" rows={3} placeholder={"bob\ncarol lead"} />
        {fieldError("members")}
      </label>

      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
