import test from "node:test";
import assert from "node:assert";
import TobsDB from "../dist/index.mjs";

/** @type {TobsDB} */
let db;

await test("Connection", async () => {
  db = await TobsDB.connect(
    "ws://localhost:7085",
    "test_nodejs_client",
    "/home/tobs/code/projects/tobsdb/schema.tdb"
  );
});

await db.create("warm-up", {});

await test("NESTED vectors", async (t) => {
  await t.test("Nested vectors: Create a new table", async () => {
    const vec3 = [
      [
        ["hello", "world"],
        ["world", "hello"],
      ],
      [["hi there"], ["how are you?"]],
    ];

    const res = await db.create("nested_vec", {
      vec2: [[1], [2], [3]],
      vec3,
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.id);
    assert.deepStrictEqual(res.data.vec2, [[1], [2], [3]]);
    assert.deepStrictEqual(res.data.vec3, vec3);
  });

  await t.test("Nested vectors: Find tables with nested vector", async () => {
    const count = 20;
    const vec2 = [[101], [6969], [420]];
    const r_create = await db.createMany(
      "nested_vec",
      Array(count).fill({ vec2 })
    );

    assert.strictEqual(r_create.status, 201);
    assert.strictEqual(r_create.data.length, count);

    const res = await db.findMany("nested_vec", { vec2 });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length % count, 0);
    assert.deepStrictEqual(res.data[0].vec2, vec2);
  });
});

while (db.ws.listenerCount("message") > 0) {}
db.disconnect();
