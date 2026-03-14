const STORAGE_KEY = "familyMealPlanner.v2.binder";
const DEFAULT_GENERATOR = "web";
const DEFAULT_OPENAI_MODEL = "gpt-5.2-chat-latest";
const DEFAULT_PREFER_COMMON_FOODS = true;
const PERSONAL_CONFIG = {
  // Personal-use shortcut: paste your key here if you do not want to enter it in the UI.
  openAiApiKey: ""
};
const COMMON_FOOD_LIBRARY = {
  Breakfast: [
    { food: "Scrambled eggs with oatmeal and bananas", alternatives: "Greek yogurt with granola and fruit", items: ["eggs", "oats", "bananas", "milk"] },
    { food: "Peanut butter toast with apples and milk", alternatives: "Oatmeal with peanut butter and banana", items: ["bread", "peanut butter", "apples", "milk"] },
    { food: "Greek yogurt parfaits with oats and berries", alternatives: "Cottage cheese with fruit and toast", items: ["greek yogurt", "oats", "frozen berries", "bread"] },
    { food: "Breakfast burritos with eggs and potatoes", alternatives: "Eggs with toast and orange slices", items: ["eggs", "tortillas", "potatoes", "cheese"] }
  ],
  Lunch: [
    { food: "Chicken rice bowls with broccoli", alternatives: "Ground turkey rice bowls with mixed vegetables", items: ["boneless chicken breast", "rice", "broccoli", "frozen vegetables"] },
    { food: "Turkey sandwiches with apples", alternatives: "Chicken wraps with carrots", items: ["bread", "deli turkey", "cheese", "apples"] },
    { food: "Baked potato bowls with beef and green beans", alternatives: "Rice bowls with chicken and corn", items: ["potatoes", "ground beef", "green beans", "cheese"] },
    { food: "Chicken pasta with peas", alternatives: "Simple chicken pasta with mixed vegetables", items: ["pasta", "boneless chicken breast", "peas", "cheese"] }
  ],
  Snack: [
    { food: "Greek yogurt and almonds", alternatives: "Cottage cheese and fruit", items: ["greek yogurt", "almonds"] },
    { food: "Apples with peanut butter", alternatives: "Bananas with peanut butter", items: ["apples", "peanut butter"] },
    { food: "String cheese and crackers", alternatives: "Greek yogurt cup", items: ["string cheese", "crackers"] },
    { food: "Hard-boiled eggs and toast", alternatives: "Trail mix and fruit", items: ["eggs", "bread"] }
  ],
  Dinner: [
    { food: "Ground beef tacos with rice and corn", alternatives: "Chicken tacos with beans", items: ["ground beef", "tortillas", "rice", "corn"] },
    { food: "Baked chicken thighs with potatoes and green beans", alternatives: "Chicken breast with rice and broccoli", items: ["boneless chicken thighs", "potatoes", "green beans"] },
    { food: "Spaghetti with meat sauce and salad", alternatives: "Pasta bake with chicken and peas", items: ["pasta", "ground beef", "tomato sauce", "lettuce"] },
    { food: "Sheet-pan sausage, potatoes, and vegetables", alternatives: "Ground turkey skillet with potatoes", items: ["sausage", "potatoes", "frozen vegetables"] }
  ],
  "Late Snack": [
    { food: "Cottage cheese with honey", alternatives: "Greek yogurt with honey", items: ["cottage cheese", "honey"] },
    { food: "Milk and peanut butter toast", alternatives: "Cheese and crackers", items: ["milk", "bread", "peanut butter"] },
    { food: "Greek yogurt with granola", alternatives: "Cottage cheese with fruit", items: ["greek yogurt", "granola"] },
    { food: "Banana with peanut butter", alternatives: "Apple slices and cheese", items: ["bananas", "peanut butter"] }
  ]
};

const peopleList = document.getElementById("peopleList");
const personTemplate = document.getElementById("personTemplate");
const statusEl = document.getElementById("status");
const binderPreview = document.getElementById("binderPreview");

const storeHints = ["Walmart", "Costco", "Super 1", "Rosauers", "Albertsons", "Smith's", "Amazon"];

const priceMap = {
  eggs: 3.15, milk: 3.79, "boneless chicken breast": 3.99, "boneless chicken thighs": 2.99,
  "ground beef": 4.79, rice: 1.29, potatoes: 0.89, "frozen vegetables": 2.29, oats: 3.79,
  "greek yogurt": 5.99, "cottage cheese": 3.49, bread: 2.59, tortillas: 3.29,
  pasta: 1.49, bananas: 0.59, apples: 1.39, peanut: 2.99, almonds: 5.99, honey: 4.99
};

let lastPlan = null;
const PERSON_CARD_COLORS = [
  { accent: "#38bdf8", soft: "rgba(56, 189, 248, 0.12)" },
  { accent: "#f97316", soft: "rgba(249, 115, 22, 0.12)" },
  { accent: "#a3e635", soft: "rgba(163, 230, 53, 0.12)" },
  { accent: "#f472b6", soft: "rgba(244, 114, 182, 0.12)" },
  { accent: "#facc15", soft: "rgba(250, 204, 21, 0.12)" },
  { accent: "#22c55e", soft: "rgba(34, 197, 94, 0.12)" }
];

document.getElementById("addPersonBtn").addEventListener("click", () => addPerson());
document.getElementById("saveSetupBtn").addEventListener("click", saveSetup);
document.getElementById("loadSetupBtn").addEventListener("click", loadSetup);
document.getElementById("generateBtn").addEventListener("click", () => generateBinder(false));
document.getElementById("refreshBtn").addEventListener("click", () => generateBinder(true));
document.getElementById("printBtn").addEventListener("click", () => window.print());
binderPreview.addEventListener("change", handlePreviewEdit);

function addPerson(data = {}) {
  const node = personTemplate.content.firstElementChild.cloneNode(true);
  for (const input of node.querySelectorAll("[data-field]")) {
    if (data[input.dataset.field] !== undefined) input.value = data[input.dataset.field];
  }
  node.querySelector(".removePersonBtn").addEventListener("click", () => {
    node.remove();
    refreshPersonCards();
  });
  peopleList.appendChild(node);
  refreshPersonCards();
}

function refreshPersonCards() {
  const cards = Array.from(peopleList.querySelectorAll(".person"));
  cards.forEach((card, index) => {
    const palette = PERSON_CARD_COLORS[index % PERSON_CARD_COLORS.length];
    card.style.setProperty("--person-accent", palette.accent);
    card.style.setProperty("--person-accent-soft", palette.soft);
    card.dataset.personNumber = String(index + 1);
    const numberEl = card.querySelector(".person-number");
    if (numberEl) numberEl.textContent = String(index + 1);
  });
}

function parseBudgetValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100) / 100;
}

function sanitizeItemList(items) {
  return items.map((item) => item.trim().toLowerCase()).filter(Boolean);
}

function mealMatchesExclusions(meal, excludes) {
  const haystack = [meal.food, meal.alternatives, ...(meal.items || [])].join(" ").toLowerCase();
  return excludes.every((exclude) => !haystack.includes(exclude));
}

function readSetup() {
  const members = Array.from(peopleList.querySelectorAll(".person")).map((p) => {
    const get = (f) => p.querySelector(`[data-field='${f}']`).value;
    return {
      name: get("name") || "Person",
      age: Number(get("age") || 30),
      sex: get("sex"),
      heightIn: Number(get("heightIn") || 66),
      weightLb: Number(get("weightLb") || 160),
      activity: get("activity"),
      goal: get("goal")
    };
  });

  return {
    familyName: document.getElementById("familyName").value.trim() || "Family",
    preparedBy: document.getElementById("preparedBy").value.trim() || "Dad",
    excludeFoods: sanitizeItemList(document.getElementById("excludeFoods").value.split(",")),
    preferCommonFoods: document.getElementById("preferCommonFoods").checked,
    weeklyBudget: parseBudgetValue(document.getElementById("weeklyBudget").value),
    generator: DEFAULT_GENERATOR,
    openAiModel: DEFAULT_OPENAI_MODEL,
    openAiApiKey: document.getElementById("openAiApiKey").value.trim() || PERSONAL_CONFIG.openAiApiKey.trim(),
    members
  };
}

function applySetup(setup) {
  document.getElementById("familyName").value = setup.familyName || "";
  document.getElementById("preparedBy").value = setup.preparedBy || "";
  document.getElementById("excludeFoods").value = (setup.excludeFoods || []).join(", ");
  document.getElementById("preferCommonFoods").checked = setup.preferCommonFoods ?? DEFAULT_PREFER_COMMON_FOODS;
  document.getElementById("weeklyBudget").value = setup.weeklyBudget || "";
  document.getElementById("openAiApiKey").value = setup.openAiApiKey || PERSONAL_CONFIG.openAiApiKey || "";
  peopleList.innerHTML = "";
  (setup.members || []).forEach(addPerson);
  refreshPersonCards();
}

function saveSetup() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(readSetup()));
  statusEl.textContent = "Setup saved.";
}

function loadSetup() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  applySetup(JSON.parse(raw));
  statusEl.textContent = "Setup loaded.";
}

function activityMultiplier(activity) {
  return ({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 })[activity] || 1.55;
}

function targetCalories(person) {
  const kg = person.weightLb * 0.453592;
  const cm = person.heightIn * 2.54;
  const bmr = person.sex === "male" ? 10 * kg + 6.25 * cm - 5 * person.age + 5 : 10 * kg + 6.25 * cm - 5 * person.age - 161;
  const tdee = bmr * activityMultiplier(person.activity);
  if (person.goal === "gain") return Math.round(tdee + 350);
  if (person.goal === "lose") return Math.max(1200, Math.round(tdee - 450));
  return Math.round(tdee);
}

function servingText(mealType, cals) {
  const proteinOz = cals >= 2700 ? 8 : cals >= 2100 ? 5 : 4;
  const starch = cals >= 2700 ? "1.5 cups" : cals >= 2100 ? "1 cup" : "3/4 cup";
  if (mealType === "Breakfast") return cals >= 2700 ? "4 eggs, 1 cup oatmeal, 1 tbsp peanut butter, 1 cup milk" : cals >= 2100 ? "3 eggs, 3/4 cup oatmeal, 1 tsp peanut butter, 3/4 cup milk" : "2 eggs, 1/2 cup oatmeal, 1 tsp peanut butter, 1/2 cup milk";
  if (mealType === "Lunch") return `${proteinOz} oz protein, ${starch} starch, 1 cup vegetables`;
  if (mealType === "Snack") return cals >= 2700 ? "1 cup yogurt + 2 tbsp almonds" : cals >= 2100 ? "1 cup yogurt + 1 tbsp almonds" : "3/4 cup yogurt + 1 tbsp almonds";
  if (mealType === "Dinner") return `${proteinOz} oz protein, ${starch} starch, 1 cup vegetables`;
  return cals >= 2700 ? "1 cup cottage cheese + 1 tbsp honey" : cals >= 2100 ? "3/4 cup cottage cheese + 1 tsp honey" : "1/2 cup cottage cheese + 1 tsp honey";
}

function normalizeMeals(rawDays) {
  const mealSlots = ["Breakfast", "Lunch", "Snack", "Dinner", "Late Snack"];
  const fallback = [
    ["Eggs, oatmeal, peanut butter, milk", "Eggs or Greek yogurt; oatmeal or cereal; peanut butter or almond butter"],
    ["Chicken breast rice bowl with broccoli", "Boneless chicken breast or ground turkey; rice or potatoes; broccoli or green beans"],
    ["Greek yogurt and almonds", "Cottage cheese and almonds; string cheese and crackers"],
    ["Ground beef, potatoes, green beans", "Ground turkey or pork; potatoes or rice; frozen mixed vegetables"],
    ["Cottage cheese and honey", "Greek yogurt and honey; milk and peanut butter toast"]
  ];

  const days = [];
  for (let i = 0; i < 28; i += 1) {
    const src = rawDays?.[i] || {};
    const meals = mealSlots.map((slot, idx) => ({
      meal: slot,
      food: src[slot]?.food || src[slot]?.meal || fallback[idx][0],
      alternatives: src[slot]?.alternatives || src[slot]?.alt || fallback[idx][1],
      items: Array.isArray(src[slot]?.items) ? sanitizeItemList(src[slot].items) : sanitizeItemList(fallback[idx][0].split(", "))
    }));
    days.push({ day: i + 1, meals });
  }
  return days;
}

function buildGenerationRequirements(setup) {
  const requirements = [
    "Return 28 days.",
    "Each day has Breakfast, Lunch, Snack, Dinner, Late Snack.",
    "Include alternatives.",
    "Budget-friendly proteins and frozen vegetables preferred."
  ];

  if (setup.excludeFoods.length) {
    requirements.push(`Exclude these foods: ${setup.excludeFoods.join(", ")}.`);
  }

  if (setup.preferCommonFoods) {
    requirements.push("Use only common everyday foods sold in normal grocery stores. Avoid gourmet, niche, or hard-to-find ingredients.");
  }

  if (setup.weeklyBudget > 0) {
    requirements.push(`Keep each 7-day grocery list close to or under $${setup.weeklyBudget.toFixed(2)} using repeated ingredients and economical meals.`);
  }

  return requirements.join(" ");
}

function cloneMealTemplate(slot, index) {
  const templates = COMMON_FOOD_LIBRARY[slot] || [];
  const meal = templates[index % Math.max(1, templates.length)] || { food: `${slot} meal`, alternatives: "User alternative", items: ["eggs"] };
  return {
    food: meal.food,
    alternatives: meal.alternatives,
    items: [...meal.items]
  };
}

function buildCommonFoodDays(setup, variant = 0) {
  const mealSlots = ["Breakfast", "Lunch", "Snack", "Dinner", "Late Snack"];
  const days = [];
  const rotation = Math.abs(Number(variant) || 0);

  for (let dayIndex = 0; dayIndex < 28; dayIndex += 1) {
    const day = {};

    mealSlots.forEach((slot, slotIndex) => {
      const templates = COMMON_FOOD_LIBRARY[slot] || [];
      const candidates = templates.filter((meal) => mealMatchesExclusions(meal, setup.excludeFoods));
      const source = candidates.length ? candidates : templates;
      const pickIndex = (dayIndex + slotIndex + rotation) % Math.max(1, source.length);
      const pick = source[pickIndex] || { food: `${slot} meal`, alternatives: "User alternative", items: ["eggs"] };
      day[slot] = {
        food: pick.food,
        alternatives: pick.alternatives,
        items: [...pick.items]
      };
    });

    days.push(day);
  }

  return normalizeMeals(days);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchOpenAIDays(setup, refresh) {
  if (!setup.openAiApiKey) throw new Error("OpenAI API key required for ChatGPT source.");
  const payload = {
    members: setup.members.map((m) => ({ name: m.name, targetCalories: targetCalories(m) })),
    excludes: setup.excludeFoods,
    refresh,
    requirements: buildGenerationRequirements(setup)
  };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${setup.openAiApiKey}` },
    body: JSON.stringify({
      model: setup.openAiModel,
      input: [
        { role: "system", content: "You generate family meal plan JSON only." },
        { role: "user", content: `Return JSON object with key 'days'. Each day includes keys Breakfast,Lunch,Snack,Dinner,Late Snack each with food, alternatives, items[] . Data: ${JSON.stringify(payload)}` }
      ],
      text: { format: { type: "json_object" } }
    })
  });
  if (!res.ok) {
    let apiMessage = "";
    let apiType = "";
    let apiCode = "";

    try {
      const errorData = await res.json();
      apiMessage = errorData.error?.message || "";
      apiType = errorData.error?.type || "";
      apiCode = errorData.error?.code || "";
    } catch {
      apiMessage = await res.text();
    }

    const retryAfter = res.headers.get("retry-after");
    const details = [apiMessage, apiType, apiCode].filter(Boolean).join(" | ");

    if (res.status === 429) {
      const retrySuffix = retryAfter ? ` Retry after ${retryAfter} seconds.` : "";
      throw new Error(`OpenAI 429${details ? `: ${details}` : " rate limit or quota issue."}${retrySuffix}`);
    }

    throw new Error(`OpenAI API error ${res.status}${details ? `: ${details}` : ""}`);
  }
  const data = await res.json();
  const parsed = JSON.parse(data.output_text || data.output?.[0]?.content?.[0]?.text || "{}");
  return normalizeMeals(parsed.days);
}

async function fetchPreferredDays(setup, refresh, variant = 0) {
  if (setup.generator === "web") {
    try {
      const days = await fetchWebDays(setup, variant);
      return {
        days,
        source: "web source fallback"
      };
    } catch (error) {
      console.warn("Web source generation failed, falling back to ChatGPT.", error);
      statusEl.textContent = `Web source unavailable (${error.message}). Trying ChatGPT fallback...`;
    }
  }

  if (setup.openAiApiKey) {
    const days = await fetchOpenAIDays(setup, refresh);
    return {
      days,
      source: "ChatGPT fallback"
    };
  }

  if (setup.generator === "web") {
    throw new Error("Web source failed and no OpenAI fallback key is configured.");
  }

  const days = await fetchWebDays(setup, variant);
  return {
    days,
    source: "web source fallback"
  };
}

async function fetchWebDays(setup, variant = 0) {
  if (setup.preferCommonFoods || setup.weeklyBudget > 0) {
    return buildCommonFoodDays(setup, variant);
  }

  const pool = [];
  for (let i = 0; i < 40; i += 1) {
    const res = await fetch("https://www.themealdb.com/api/json/v1/1/random.php");
    if (!res.ok) continue;
    const data = await res.json();
    const meal = data.meals?.[0];
    if (!meal) continue;

    const normalizedMeal = {
      food: (meal.strMeal || "Meal").trim(),
      alternatives: `Alternative ${meal.strCategory || "family"} meal`,
      items: ["eggs", "rice", "frozen vegetables", "boneless chicken breast"]
    };

    if (!mealMatchesExclusions(normalizedMeal, setup.excludeFoods)) continue;
    pool.push(normalizedMeal);
  }

  const mealSlots = ["Breakfast", "Lunch", "Snack", "Dinner", "Late Snack"];
  const days = [];
  for (let dayIndex = 0; dayIndex < 28; dayIndex += 1) {
    const day = {};
    mealSlots.forEach((slot, slotIndex) => {
      const pick = pool[(dayIndex * mealSlots.length + slotIndex) % Math.max(1, pool.length)] || { food: `${slot} meal`, alternatives: "User alternative", items: ["eggs"] };
      day[slot] = {
        food: pick.food,
        alternatives: pick.alternatives,
        items: [...pick.items]
      };
    });
    days.push(day);
  }
  return normalizeMeals(days);
}

function gatherWeekItems(weekDays) {
  const counts = new Map();
  weekDays.forEach((day) => day.meals.forEach((meal) => meal.items.forEach((item) => {
    const key = item.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  })));

  return Array.from(counts.entries()).map(([item, count], index) => {
    const match = Object.keys(priceMap).find((key) => item.includes(key));
    const unitCost = match ? priceMap[match] : 2.5;
    return {
      item,
      qty: count > 8 ? `${Math.ceil(count / 2)} lb` : `${count} units`,
      store: storeHints[index % storeHints.length],
      cost: unitCost * Math.max(1, count / 4)
    };
  });
}

function summarizeBudget(total, budget) {
  if (!budget) return "";
  const delta = budget - total;
  const className = delta >= 0 ? "budget-ok" : "budget-over";
  const summary = delta >= 0 ? `$${delta.toFixed(2)} under budget` : `$${Math.abs(delta).toFixed(2)} over budget`;
  return `<p class="${className}">Weekly budget target: $${budget.toFixed(2)}. Estimated total: $${total.toFixed(2)}. ${summary}.</p>`;
}

function renderWeeklyGroceryTable(items, budget) {
  let total = 0;
  const rows = items.map((item) => {
    total += item.cost;
    return `<tr><td>[ ]</td><td>${item.item}</td><td>${item.qty}</td><td>${item.store}</td><td>$${item.cost.toFixed(2)}</td></tr>`;
  }).join("");
  return `${summarizeBudget(total, budget)}<table class='binder-table'><tr><th>Check</th><th>Item</th><th>Qty</th><th>Store</th><th>Est. Cost</th></tr>${rows}<tr><td></td><td></td><td></td><td><strong>Estimated Weekly Total</strong></td><td><strong>$${total.toFixed(2)}</strong></td></tr></table>`;
}

function renderDailyChecklist(day) {
  const uniqueItems = [...new Set(day.meals.flatMap((meal) => meal.items))];
  const left = uniqueItems.slice(0, Math.ceil(uniqueItems.length / 2));
  const right = uniqueItems.slice(Math.ceil(uniqueItems.length / 2));
  const column = (items) => `<table class='binder-table'><tr><th>Check</th><th>Item</th></tr>${items.map((item) => `<tr><td>[ ]</td><td>${item}</td></tr>`).join("")}</table>`;
  return `<div class='two-col'>${column(left)}${column(right)}</div>`;
}

function renderMealsTable(day) {
  const rows = day.meals.map((meal, mealIndex) => `<tr>
    <td>${meal.meal}</td>
    <td><input class="inline-edit" data-day-index="${day.day - 1}" data-meal-index="${mealIndex}" data-field="food" value="${escapeHtml(meal.food)}" /></td>
    <td><textarea class="inline-edit inline-edit-area" data-day-index="${day.day - 1}" data-meal-index="${mealIndex}" data-field="alternatives">${escapeHtml(meal.alternatives)}</textarea></td>
    <td><textarea class="inline-edit inline-edit-area" data-day-index="${day.day - 1}" data-meal-index="${mealIndex}" data-field="items">${escapeHtml(meal.items.join(", "))}</textarea></td>
  </tr>`).join("");
  return `<h3>Meals and Alternatives</h3><p class='small edit-note'>Edit meals inline. Grocery totals update after the field loses focus.</p><table class='binder-table binder-table-edit'><tr><th style='width:12%'>Meal</th><th style='width:28%'>Food</th><th style='width:30%'>Alternatives</th><th style='width:30%'>Grocery Items</th></tr>${rows}</table>`;
}

function renderPortionsTable(day, setup) {
  const names = setup.members.map((member) => member.name);
  const rows = day.meals.map((meal) => {
    const cells = setup.members.map((person) => `<td>${servingText(meal.meal, targetCalories(person))}</td>`).join("");
    return `<tr><td>${meal.meal}</td>${cells}</tr>`;
  }).join("");
  return `<h3>Portion Sizes by Person</h3><table class='binder-table'><tr><th style='width:12%'>Meal</th>${names.map((name) => `<th>${name}</th>`).join("")}</tr>${rows}</table>`;
}

function buildBinderHtml(setup, days) {
  const pages = [];
  pages.push(`<section class='page center'><h1>28-Day Family Meal Plan</h1><p>Nutrition and Meal Planning Guide for the ${setup.familyName} Family</p><p>Prepared by ${setup.preparedBy}</p><p>Designed for daily meal preparation and weekly grocery planning.</p><p class='small'>Common foods only: ${setup.preferCommonFoods ? "Yes" : "No"}${setup.weeklyBudget ? ` | Weekly budget target: $${setup.weeklyBudget.toFixed(2)}` : ""}</p></section>`);

  for (let week = 0; week < 4; week += 1) {
    const weekStart = week * 7;
    const weekDays = days.slice(weekStart, weekStart + 7);
    const grocery = gatherWeekItems(weekDays);

    pages.push(`<section class='page center'><h1>Week ${week + 1}</h1><p>Meal Plan and Grocery Guide</p></section>`);
    pages.push(`<section class='page'><h2>Week ${week + 1} Grocery List</h2>${renderWeeklyGroceryTable(grocery, setup.weeklyBudget)}</section>`);
    pages.push(`<section class='page'><h2>Sunday Prep Guide - Batch Cooking</h2><table class='binder-table'><tr><th>Prep Task</th><th>Amount</th></tr><tr><td>Cook boneless chicken breast</td><td>~6 lb</td></tr><tr><td>Cook boneless chicken thighs</td><td>~3 lb</td></tr><tr><td>Brown ground beef</td><td>~8 lb</td></tr><tr><td>Cook rice</td><td>~10 to 12 cups dry</td></tr><tr><td>Bake potatoes</td><td>~8 to 10 lb</td></tr><tr><td>Boil eggs</td><td>~2 dozen</td></tr></table><p class='small'>Meals are cooked in bulk and split at serving time using daily portion tables.</p></section>`);

    pages.push(`<section class='page'><h2>Sunday Prep Guide - Snack Prep</h2><p class='small'>Prepare individual snack containers for each person. Container counts below are for the full week.</p><table class='binder-table'><tr><th>Snack</th>${setup.members.map((member) => `<th>${member.name}</th>`).join("")}</tr>${[
      "Greek yogurt and almonds", "Peanut butter banana", "Hard boiled eggs and toast", "Protein smoothie", "String cheese and crackers", "Greek yogurt and granola", "Apple and peanut butter"
    ].map((snack) => `<tr><td>${snack}<br/>1 day(s)</td>${setup.members.map((person) => `<td>1 containers<br/>${servingText("Snack", targetCalories(person))}</td>`).join("")}</tr>`).join("")}</table><table class='binder-table'><tr><th>Late Snack</th>${setup.members.map((member) => `<th>${member.name}</th>`).join("")}</tr>${[
      "Cottage cheese and honey", "Greek yogurt and granola", "Milk and almonds", "Cottage cheese and fruit", "Peanut butter toast", "Milk and peanut butter", "Greek yogurt and honey"
    ].map((snack) => `<tr><td>${snack}<br/>1 day(s)</td>${setup.members.map((person) => `<td>1 containers<br/>${servingText("Late Snack", targetCalories(person))}</td>`).join("")}</tr>`).join("")}</table></section>`);

    weekDays.forEach((day) => {
      pages.push(`<section class='page'><h2>Day ${day.day}</h2>${renderMealsTable(day)}${renderPortionsTable(day, setup)}</section>`);
      pages.push(`<section class='page'><h2>Day ${day.day} Grocery Checklist</h2>${renderDailyChecklist(day)}</section>`);
    });
  }
  return pages.join("\n");
}

function renderBinder(setup, days) {
  binderPreview.innerHTML = buildBinderHtml(setup, days);
}

function handlePreviewEdit(event) {
  const target = event.target;
  if (!target.matches("[data-day-index][data-meal-index][data-field]") || !lastPlan) return;

  const day = lastPlan.days[Number(target.dataset.dayIndex)];
  const meal = day?.meals?.[Number(target.dataset.mealIndex)];
  if (!meal) return;

  const value = target.value.trim();
  if (target.dataset.field === "food") {
    meal.food = value || `${meal.meal} meal`;
  } else if (target.dataset.field === "alternatives") {
    meal.alternatives = value || "User alternative";
  } else if (target.dataset.field === "items") {
    meal.items = sanitizeItemList(value.split(","));
    if (!meal.items.length) meal.items = ["eggs"];
  }

  renderBinder(lastPlan.setup, lastPlan.days);
  statusEl.textContent = `Updated Day ${day.day} ${meal.meal}.`;
}

async function generateBinder(refresh) {
  const setup = readSetup();
  if (!setup.members.length) {
    statusEl.textContent = "Add at least one person.";
    return;
  }

  try {
    const variant = Date.now();
    statusEl.textContent = refresh ? "Refreshing meals..." : "Generating binder...";
    const { days, source } = await fetchPreferredDays(setup, refresh, variant);

    lastPlan = { setup, days };
    renderBinder(setup, days);
    statusEl.textContent = `Status: Ready. Source: ${source}.`;
  } catch (error) {
    statusEl.textContent = `Generation failed: ${error.message}`;
  }
}

if (!localStorage.getItem(STORAGE_KEY)) {
  document.getElementById("preferCommonFoods").checked = DEFAULT_PREFER_COMMON_FOODS;
  addPerson({ name: "Dad", age: 39, sex: "male", heightIn: 73, weightLb: 175, activity: "active", goal: "gain" });
  addPerson({ name: "Mom", age: 37, sex: "female", heightIn: 66, weightLb: 285, activity: "light", goal: "lose" });
  addPerson({ name: "James", age: 10, sex: "male", heightIn: 61, weightLb: 150, activity: "light", goal: "lose" });
  addPerson({ name: "Andrew", age: 13, sex: "male", heightIn: 65, weightLb: 220, activity: "light", goal: "lose" });
  addPerson({ name: "Laurynn", age: 14, sex: "female", heightIn: 65, weightLb: 300, activity: "light", goal: "lose" });
} else {
  loadSetup();
}
