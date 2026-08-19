/* The streak bank. Rules: every entry is a fact about the world, never about
   this program. Nothing repeats. Each day shows a teaser for the next one. ---- */
"use strict";

/* Keyed to an exact day count. */
const DAYS = {
  1:  "The Anglo-Zanzibar War of 1896 lasted 38 minutes. You have already outlasted a war.",
  2:  "The energy you have burned so far is roughly the muzzle energy of two thousand 9mm rounds.",
  3:  "Apollo 11 took three days just to reach the Moon.",
  4:  "Gettysburg was three days. Waterloo was one.",
  5:  "The 1928 Olympics ran the 800 m for women, then banned it for 32 years because the finishers looked tired.",
  6:  "The Six-Day War. You have matched it.",
  7:  "Apollo 13 was launched, crippled and home again in five days and twenty-two hours. You have outlasted the most famous rescue in spaceflight.",
  8:  "Apollo 11 went to the Moon and came back in 8 days, 3 hours and 18 minutes. You have now been at this longer than the entire Moon landing.",
  9:  "The Hindenburg crossed the Atlantic in about 60 hours. You have been going four times longer.",
  10: "Every taste bud on your tongue has been replaced since you started. They turn over roughly every ten days.",
  11: "The Berlin Wall went up in a single night in August 1961 and stood for 10,315 days.",
  12: "Twelve men have walked on the Moon. One day each.",
  13: "The Cuban Missile Crisis lasted thirteen days in October 1962. Nobody slept much.",
  14: "A fortnight. The Moon has gone from full to new since you started.",
  15: "Light that left the Sun on your first morning is now four times further out than Pluto.",
  16: "Columbia's longest shuttle mission was 15 days and 21 hours. You have beaten it.",
  17: "The 33 Chilean miners spent 17 days trapped before anyone above ground knew they were alive.",
  18: "The Wright brothers' four flights on 17 December 1903 totalled 98 seconds in the air. All of powered flight starts there.",
  19: "Magellan's fleet needed 38 days just to get through the strait that now carries his name.",
  20: "You have burned about the energy stored in a third of a litre of gasoline.",
  21: "A radio command to Voyager 1 takes about 23 hours to arrive. You are nearly one full round-trip in.",
  22: "Ranulph Fiennes ran seven marathons on seven continents in seven days, aged 59, four months after a heart attack and a double bypass.",
  23: "The outer layer of your cornea has fully replaced itself three times since day one.",
  24: "Usain Bolt's top speed was 44.7 km/h, held for about a fifth of a second. Nobody has beaten it since 2009.",
  25: "The longest anyone has held their breath is 24 minutes 37 seconds. You have been at this about 1,400 times longer.",
  26: "Krakatoa erupted in 1883 loud enough to be heard 4,800 km away, and burst the eardrums of sailors 64 km out.",
  27: "The Moon has completed one full orbit of Earth since you started. It takes 27.3 days.",
  28: "The Sun has rotated once at its equator. It takes 25 days there and 35 at the poles — it is not solid, so it does not spin as one piece.",
  29: "Wilhelm Röntgen discovered X-rays on 8 November 1895 and had imaged his wife's hand within weeks. She said: I have seen my death.",
  30: "Kílian Jornet climbed Everest twice in one week in 2017, without supplemental oxygen and without fixed ropes.",
  31: "Randy Gardner stayed awake for 11 days in 1964 for a school science fair. The record was retired as too dangerous to attempt.",
  32: "A diving blue whale's heart beats about twice a minute. You have been going for roughly 92,000 of its heartbeats.",
  33: "Lindbergh crossed the Atlantic alone in 33 hours 30 minutes, awake the entire way, with no forward windscreen — he navigated with a periscope.",
  34: "The deepest hole ever drilled reached 12.26 km after 20 years. The crust is 35 km thick.",
  35: "Every red blood cell you started with is a third of the way through its 120-day life.",
  36: "Columbus took 36 days to cross from the Canary Islands to landfall in 1492. You just made the crossing.",
  38: "The German advance through the Ardennes to the French coast in 1940 took ten days. France surrendered on day 46.",
  40: "Forty days. Noah's flood, the Lenten fast, and roughly the outer limit of what a healthy person survives without food.",
  42: "Douglas Adams' answer to everything. He said he chose it because it was a completely ordinary number.",
  45: "Shackleton's open-boat voyage to South Georgia covered 1,300 km of the Southern Ocean in 16 days, navigating by four sextant sightings.",
  48: "The Enigma code was broken, rebroken and broken again for six years. Turing's machines ran through 15 billion billion settings.",
  50: "About twenty-five sticks of dynamite of energy burned, at roughly a megajoule each.",
  55: "A day on Mercury lasts 176 Earth days — twice its own year.",
  60: "The fastest solo sail around the world is 42 days and 16 hours, François Gabart, 2017. Alone, no stops.",
  66: "The famous figure for forming a habit is 66 days. The study it comes from actually found a range from 18 to 254.",
  72: "The 1972 Andes survivors held out 72 days at 3,600 m. The search was called off on day 8.",
  75: "The Siege of Leningrad lasted 872 days. You are at day 75 of something considerably more pleasant.",
  80: "Around the World in Eighty Days. Verne's number was a genuine 1872 estimate, not a fantasy — a journalist did it in 72 in 1889.",
  88: "Mercury has gone all the way around the Sun. Its entire year is 88 Earth days.",
  90: "Sojourner, the first Mars rover, was designed to last seven days. It ran for 83.",
  100: "Napoleon's return from Elba to Waterloo is remembered as the Hundred Days. It was actually 111.",
  110: "D-Day put 156,000 men across 80 km of beach in a single day. Planning it took over a year.",
  120: "Every red blood cell in your body has been replaced since day one. Not one of them was there when you started.",
  128: "Magellan's expedition took three years. One ship of five came home, carrying 18 of the 270 men who left.",
  135: "Nellie Bly went around the world in 72 days in 1889 with one dress and a single bag, to prove Verne's number beatable.",
  150: "Roughly the energy a fighter jet's engines consume in ninety seconds at full afterburner.",
  165: "The longest recorded ultramarathon effort, the Self-Transcendence 3100, covers 5,000 km around one city block in under 52 days.",
  180: "Half a year. Earth has carried you about 470 million km around the Sun since you started.",
  200: "Valentina Tereshkova orbited Earth 48 times over three days in 1963 — more flight time than every American astronaut combined at that point.",
  225: "Venus has completed one orbit of the Sun. Its year is 225 Earth days. Its day is 243.",
  243: "One Venusian day. Venus spins so slowly that its day outlasts its year, and it spins backwards.",
  259: "A Hohmann transfer to Mars takes about 259 days. If you had left Earth the morning you started, you would be arriving today.",
  280: "A human pregnancy, first day to due date.",
  300: "The longest continuous human spaceflight is 437 days — Valeri Polyakov aboard Mir, 1994.",
  340: "Scott Kelly spent 340 consecutive days aboard the ISS. You have matched him, without the radiation.",
  365: "One year. Earth is back exactly where it started. You are not.",
  400: "Longer in a row than any human has spent in space, with one exception.",
  437: "You have now matched Valeri Polyakov's 437 days aboard Mir. Nobody has beaten that since 1995."
};

/* Used on days with no keyed entry. Indexed so they never repeat. */
const POOL = [
  "Your body has produced about two million red blood cells in the time this session took.",
  "The Voyager Golden Record is expected to remain playable for a billion years. Nothing else humans have made comes close.",
  "An octopus has nine brains and blue blood, and two thirds of its neurons are in its arms.",
  "The 1904 Olympic marathon was won by a man who was driven eleven miles of it. He was disqualified, and second place had been taking strychnine.",
  "Tardigrades survive vacuum, 150°C, and 1,000 times the radiation that kills a human. They have been to space and come back fine.",
  "A hummingbird's heart runs at 1,200 beats a minute in flight and 50 while it sleeps.",
  "The Great Wall is not visible from space with the naked eye. Airport runways are.",
  "Hannibal crossed the Alps with 37 elephants in 218 BC. One survived the first winter in Italy.",
  "Your bones are being dismantled and rebuilt continuously. The skeleton you have now is roughly ten years old.",
  "Concorde flew Heathrow to JFK in 2 hours 52 minutes. Nothing has flown that route faster since it retired in 2003.",
  "The Antikythera mechanism modelled the heavens with 30 bronze gears in about 100 BC. Nothing that intricate reappeared for 1,400 years.",
  "A single bolt of lightning carries about a billion joules — roughly two thousand of your sessions, delivered in 30 microseconds.",
  "Emperor penguins hold a huddle in −60°C winds for two months without eating, rotating so nobody stays on the outside.",
  "The Dutch cyclist Fred Rompelberg hit 268 km/h on a bicycle in 1995, drafting behind a dragster on the Bonneville flats.",
  "Light takes 100,000 years to cross our galaxy and 8 minutes to reach you from the Sun.",
  "The Roman army marched 30 km a day carrying 30 kg, then built a fortified camp every single night.",
  "There are more possible arrangements of a shuffled deck than atoms in our galaxy. Every shuffle you have ever done was almost certainly a first.",
  "Mount Everest grows about 4 mm a year. The Himalayas are still colliding.",
  "A blue whale's aorta is wide enough for a human to crawl through.",
  "The last woolly mammoths were alive on Wrangel Island while the Great Pyramid was already standing.",
  "The Sun loses four million tonnes of mass every second, converting it to the light you feel on your face.",
  "Eddy Merckx set the hour record in 1972 at 49.4 km, then said it was the hardest ride of his life and never attempted it again.",
  "Your stomach lining replaces itself every three to five days, because otherwise it would digest itself.",
  "The 1914 Christmas truce involved about 100,000 men along the Western Front. High command banned any repeat the following year.",
  "Honeybees navigate by polarised light, and tell each other where the flowers are by dancing the angle relative to the Sun.",
  "Diana Nyad swam Cuba to Florida at 64, on her fifth attempt, 177 km in 53 hours, without a shark cage.",
  "The Chicxulub impactor was about 10 km across and released the energy of ten billion Hiroshimas in a second.",
  "The Library of Alexandria did not burn down in one night. It declined over centuries of funding cuts.",
  "A cubic metre of seawater holds about 25 kg of salt and roughly 13 billionths of a gram of gold.",
  "Wim Hof climbed to 7,200 m on Everest in shorts. Physiologists studied him for years before accepting the breathing was doing it.",
  "Neutron star material is so dense that a teaspoon would weigh about the same as Mount Everest.",
  "The Spanish flu killed more people in 1918 than the war it followed, and the youngest and healthiest died fastest.",
  "Your eyes make about three saccades a second. Your brain deletes the motion blur between them, which is why you never see it.",
  "Genghis Khan's messengers covered 300 km a day by changing horses at relay stations across an empire 9,000 km wide.",
  "There is enough DNA in your body, uncoiled, to reach the Sun and back roughly sixty times.",
  "The Trieste reached the bottom of the Mariana Trench in 1960. Only a handful of people have been back since, and twelve have walked on the Moon.",
  "Ants have been farming fungus for 60 million years, and they weed and fertilise the crop.",
  "The Colossus at Bletchley read 5,000 characters a second in 1944. Its existence stayed secret for thirty years, so its designers got no credit while computing was invented around them.",
  "A commercial jet at cruise is closer to its stall speed than most pilots find comfortable to think about.",
  "Sharks have been around longer than trees, and longer than Saturn has had rings."
];

/* Never the same one twice in a row. Stored index prevents repeats. */
const BREAKS = [
  "Reset to zero. So did the Large Hadron Collider, nine days after switch-on, when one bad solder joint cost it fourteen months. It later found the Higgs.",
  "Streak gone. Voyager 2 went silent for two weeks in 2020 because the only antenna on Earth that can reach it was pointed elsewhere for repairs. It is still transmitting.",
  "Back to day zero. Entropy is undefeated over long enough timescales. The trick has always been to keep running the experiment.",
  "Broken. The Wright brothers crashed on 14 December 1903 and flew successfully three days later.",
  "Zero again. Apollo 13 lost an oxygen tank 320,000 km from home and everyone came back alive. Losing the plan is not the same as losing.",
  "Streak over. Edison's team tested thousands of filament materials. The useful summary is that the ones that failed were still data.",
  "Reset. Shackleton's ship was crushed by ice in 1915 and the expedition became a rescue. Every one of the 28 men survived.",
  "Back to nothing. The Mars Climate Orbiter was lost in 1999 because one team used pounds and the other newtons. NASA kept going to Mars.",
  "Streak's done. Roger Bannister failed at the four-minute mile for two years before the day it worked.",
  "Zero. Continental drift was ridiculed for fifty years before the seafloor data made it obvious. Being early and being wrong look identical from inside.",
  "Broken. The first four Falcon 1 launches were failures and the company had money for exactly one more.",
  "Reset. Darwin sat on the theory for twenty years. Starting again is cheaper than that."
];

/* Milestones that are about to arrive — the reason to come back tomorrow. */
function teaseFor(day){
  const next = day + 1;
  if(DAYS[next]) return "Tomorrow: " + shortTease(DAYS[next]);
  const upcoming = Object.keys(DAYS).map(Number).filter(d => d > day).sort((a,b)=>a-b)[0];
  if(upcoming && upcoming - day <= 12) return "Day " + upcoming + " is worth getting to.";
  return null;
}
function shortTease(t){
  const first = t.split(/(?<=\.)\s/)[0];
  return first.length > 90 ? first.slice(0, 87).trim() + "…" : first;
}

function milestoneFor(day, seenPool){
  if(DAYS[day]) return {text: DAYS[day], keyed: true};
  const used = seenPool || [];
  const free = POOL.map((_,i)=>i).filter(i => !used.includes(i));
  const list = free.length ? free : POOL.map((_,i)=>i);
  const pick = list[(day * 7919) % list.length];
  return {text: POOL[pick], keyed: false, poolIndex: pick};
}

function breakMessage(lastIndex){
  let i = (typeof lastIndex === "number" ? lastIndex + 1 : 0) % BREAKS.length;
  return {text: BREAKS[i], index: i};
}
