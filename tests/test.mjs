import test from "node:test";
import assert from "assert";
import crypto from "crypto";
// import { spawn } from "child_process";
// import path from "path";
// import { fileURLToPath } from "url";

// await new Promise((res, rej) => {
//   const cwd = path.join(fileURLToPath(new URL(".", import.meta.url)), "..");
//   const proc = spawn("make run", { cwd });
//   proc.on("error", (err) => {
//     console.log(err);
//     rej(err);
//   });

//   proc.stdin.on("", (data) => {
//     console.log(data);
//     res();
//   });
//   proc.stderr.on("data", (data) => {
//     console.error(data);
//   });
// });

const API = async (path, body) => {
  return await fetch(`http://localhost:7085/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then(async (res) => {
    return res.json();
  });
};

test("CREATE", async (t) => {
  await t.test("Create a new table", async () => {
    const res = await API("create", {
      table: "example",
      data: { name: "first example", vector: [1, 2, 3] },
    });

    assert.strictEqual(res.data.name, "first example");
    assert.ok(res.data.id, "Returned row should have an id");
    assert.ok(res.data.createdAt, "Returned row should have a createdAt");
  });

  await t.test("Create a new table with relation(Int)", async () => {
    const r_create = await API("create", {
      table: "example",
      data: { name: "relation example", vector: [1, 2, 3] },
    });

    assert.strictEqual(r_create.status, 201);

    const updatedAt = Date.now();
    const res = await API("create", {
      table: "first",
      data: { updatedAt, user: r_create.data.id },
    });

    assert.ok(res.data.id, "Returned row should have an id");
    assert.strictEqual(new Date(res.data.updatedAt).getTime(), updatedAt);
    assert.ok(res.data.createdAt, "Returned row should have a createdAt");
    assert.strictEqual(res.data.user, r_create.data.id);
  });

  await t.test("Create a new table with relation(String)", async () => {
    const uniqueStr = crypto.randomUUID();
    const r_create = await API("create", {
      table: "third",
      data: { str: uniqueStr },
    });

    assert.strictEqual(r_create.status, 201);

    const res = await API("create", {
      table: "second",
      data: { rel_str: uniqueStr },
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.id, "Returned row should have an id");
    assert.ok(res.data.createdAt, "Returned row should have a createdAt");
    assert.strictEqual(res.data.rel_str, uniqueStr);
  });

  await t.test("CreateUnique: 500 new tables", async () => {
    const count = 500;
    const data = Array(count).fill({ name: `1 of ${count}`, vector: [count] });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const res = await API("create", {
        table: "example",
        data: row,
      });
      assert.strictEqual(res.status, 201, "Status code should be 201");
    }
  });

  await t.test("CreateMany: 10_000 new tables", async () => {
    const table = "example";
    const count = 10000;
    const res = await API("createMany", {
      table: table,
      data: Array(count).fill({
        name: `group of ${count}`,
        createdAt: Date.now(),
        vector: [count],
      }),
    });

    assert.strictEqual(res.data.length, count);
    assert.strictEqual(
      res.message,
      `Created ${count} new rows in table ${table}`
    );
  });

  await t.test("Error because of missing required field", async () => {
    const res = await API("create", {
      table: "example",
      data: {},
    });

    assert.strictEqual(res.status, 400);
  });

  await t.test("Error because of passing unknown table", async () => {
    const res = await API("create", {
      table: "bad_example",
      data: { deez: "nuts" },
    });

    assert.strictEqual(res.status, 404);
  });
});

test("FIND", async (t) => {
  await t.test("Find a table", async () => {
    // create row
    const r_create = await API("create", {
      table: "example",
      data: { name: "find example", vector: [1, 2, 3] },
    });

    assert.strictEqual(r_create.status, 201);

    const res = await API("findUnique", {
      table: "example",
      where: { id: r_create.data.id },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.id, r_create.data.id);
    assert.strictEqual(res.data.name, "find example");
  });

  await t.test("Find Many", async () => {
    // create rows
    const count = 50;
    const uniqueName = crypto.randomUUID();

    const r_create = await API("createMany", {
      table: "example",
      data: Array(count).fill({ name: uniqueName, vector: [1, 2, 3] }),
    });

    assert.strictEqual(r_create.status, 201);
    assert.strictEqual(r_create.data.length, count);

    const res = await API("findMany", {
      table: "example",
      where: { name: uniqueName },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, count);
  });

  await t.test("Find with Date field (manual)", async () => {
    const date = Date.now();
    const r_create = await API("create", {
      table: "example",
      data: { createdAt: date, vector: [1, 2, 3] },
    });

    assert.strictEqual(r_create.status, 201);
    assert.strictEqual(new Date(r_create.data.createdAt).getTime(), date);

    const res = await API("findMany", {
      table: "example",
      where: { createdAt: date },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(new Date(res.data[0].createdAt).getTime(), date);
  });

  await t.test("Find with Date field (auto)", async () => {
    const name = crypto.randomUUID();
    const r_create = await API("create", {
      table: "example",
      data: { name, vector: [1, 2, 3] },
    });

    assert.strictEqual(r_create.status, 201);
    assert.strictEqual(r_create.data.name, name);

    let res = await API("findMany", {
      table: "example",
      where: { name },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].name, name);

    const createdAt = res.data[0].createdAt;

    res = await API("findMany", {
      table: "example",
      where: { createdAt },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].createdAt, createdAt);
  });

  await t.test("Find with Vector field", async () => {
    const vector = [];
    for (let i = 0; i < 100; i++) {
      vector.push(parseInt(Math.random() * 100) * i);
    }

    const r_create = await API("create", {
      table: "example",
      data: { vector },
    });

    assert.strictEqual(r_create.status, 201);

    const res = await API("findMany", {
      table: "example",
      where: { vector },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].vector.length, 100);
  });
});

test("UPDATE", async (t) => {
  await t.test("Update a table", async () => {
    // create row
    const r_create = await API("create", {
      table: "example",
      data: { name: "update example", vector: [1, 2, 3] },
    });

    assert.strictEqual(r_create.status, 201);

    const res = await API("updateUnique", {
      table: "example",
      where: { id: r_create.data.id },
      data: { name: "updated", vector: [3, 2, 1] },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.id, r_create.data.id);
    assert.strictEqual(res.data.name, "updated");
    assert.deepStrictEqual(res.data.vector, [3, 2, 1]);

    const check = await API("findUnique", {
      table: "example",
      where: { id: r_create.data.id },
    });

    assert.strictEqual(check.status, 200);
    assert.strictEqual(check.data.id, r_create.data.id);
    assert.strictEqual(check.data.name, "updated");
  });

  await t.test("Update a table(relation)", async () => {
    const c_uniqueStr = crypto.randomUUID();
    const r_create = await API("create", {
      table: "third",
      data: { str: c_uniqueStr },
    });

    assert.strictEqual(r_create.status, 201);

    const res = await API("create", {
      table: "second",
      data: { rel_str: c_uniqueStr },
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.rel_str, c_uniqueStr);

    const uniqueStr = crypto.randomUUID();
    const r_create2 = await API("create", {
      table: "third",
      data: { str: uniqueStr },
    });

    assert.strictEqual(r_create2.status, 201);

    const res2 = await API("updateUnique", {
      table: "second",
      where: { id: res.data.id },
      data: { rel_str: uniqueStr },
    });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.data.rel_str, uniqueStr);
  });

  await t.test("Failed to Update a table(relation): wrong type", async () => {
    const c_uniqueStr = crypto.randomUUID();
    const r_create = await API("create", {
      table: "third",
      data: { str: c_uniqueStr },
    });

    assert.strictEqual(r_create.status, 201);

    const res = await API("create", {
      table: "second",
      data: { rel_str: c_uniqueStr },
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.rel_str, c_uniqueStr);

    const res2 = await API("updateUnique", {
      table: "second",
      where: { id: res.data.id },
      data: { rel_str: 1 },
    });

    assert.strictEqual(res2.status, 400);
  });

  await t.test(
    "Failed to Update a table(relation): relation not found",
    async () => {
      const c_uniqueStr = crypto.randomUUID();
      const r_create = await API("create", {
        table: "third",
        data: { str: c_uniqueStr },
      });

      assert.strictEqual(r_create.status, 201);

      const res = await API("create", {
        table: "second",
        data: { rel_str: c_uniqueStr },
      });

      assert.strictEqual(res.status, 201);
      assert.ok(res.data.rel_str, c_uniqueStr);

      const res2 = await API("updateUnique", {
        table: "second",
        where: { id: res.data.id },
        data: { rel_str: "no table has this rel_str value" },
      });

      assert.strictEqual(res2.status, 400);
      assert.ok(res2.message.includes("No row found for relation"));
    }
  );

  await t.test("Update 1_000 tables", async () => {
    const count = 1000;
    const uniqueName = crypto.randomUUID();

    const r_create = await API("createMany", {
      table: "example",
      data: Array(count).fill({ name: uniqueName, vector: [1, 2, 3] }),
    });

    assert.strictEqual(r_create.status, 201);
    assert.strictEqual(r_create.data.length, count);

    const res = await API("updateMany", {
      table: "example",
      where: { name: uniqueName },
      data: { name: `updated ${count}: ${uniqueName}` },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, count);

    const check = await API("findMany", {
      table: "example",
      where: { name: `updated ${count}: ${uniqueName}` },
    });

    assert.strictEqual(check.status, 200);
    assert.strictEqual(check.data.length, count);
  });
});

test("DELETE", async (t) => {
  await t.test("Delete a table", async () => {
    // create row
    const r_create = await API("create", {
      table: "example",
      data: { name: "delete example", vector: [1, 2, 3] },
    });

    assert.strictEqual(r_create.status, 201);

    const res = await API("deleteUnique", {
      table: "example",
      where: { id: r_create.data.id },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.id, r_create.data.id);
  });

  await t.test("Delete 1_000 tables", async () => {
    const count = 1000;
    const uniqueName = crypto.randomUUID();

    const r_create = await API("createMany", {
      table: "example",
      data: Array(count).fill({ name: uniqueName, vector: [1, 2, 3] }),
    });

    assert.strictEqual(r_create.status, 201);
    assert.strictEqual(r_create.data.length, count);

    const res = await API("deleteMany", {
      table: "example",
      where: { name: uniqueName },
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.length, count);
  });

  await t.test(
    "Error because of passing empty where statement to deleteUnique",
    async () => {
      const res = await API("deleteUnique", {
        table: "example",
        where: {},
      });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.message, "Where constraints cannot be empty");
    }
  );

  await t.test("Error because of passing unknown table", async () => {
    const res = await API("deleteUnique", {
      table: "bad_example",
      where: {},
    });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.message, "Table not found");
  });
});