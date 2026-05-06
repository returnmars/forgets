class User {
  #secret = "native";

  constructor(public id: string, private name: string) {}

  label() {
    return `${this.id}:${this.name}:${this.#secret}`;
  }
}

const user = new User("u1", "Ada");
const encoded = new TextEncoder().encode(JSON.stringify({ ok: true }));
const decoded = new TextDecoder().decode(encoded);
const seen = new Set(["a", "b", "a"]);
const scores = new Map<string, number>();
scores.set("a", 1);

console.log(JSON.stringify({
  label: user.label(),
  decoded,
  seen: seen.size,
  score: scores.get("a"),
}));
