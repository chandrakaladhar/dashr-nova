import { devIdentityAllowed } from "@/lib/auth";
import { currentContext } from "@/lib/session";
import { setDevIdentity } from "./actions";

/** Local and development only: who you are acting as, until a real login exists. */
export async function DevIdentity() {
  if (!devIdentityAllowed()) return null;
  const ctx = await currentContext();
  return (
    <form action={setDevIdentity} className="identity">
      <span className="tag">dev login</span>
      <label>
        User <input name="user" defaultValue={ctx?.user.id ?? "alice"} size={10} />
      </label>
      <label>
        Roles <input name="roles" defaultValue={ctx?.user.roles.join(",") ?? "researcher"} size={18} />
      </label>
      <button type="submit">{ctx ? "Switch" : "Sign in"}</button>
    </form>
  );
}
