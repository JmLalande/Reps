/* The streak bank. Two lines a day.

   DAYS is the main line, and every entry in it is about a length of time that
   matches the day it is keyed to. Day 47 gets a siege that lasted 47 days. The
   point is that the number on the screen and the number in the sentence are the
   same number, so the fact lands as a measure of the streak rather than as
   trivia that happened to come up. An entry that does not match its key belongs
   in POOL instead, however good it is.

   POOL is the bonus line: facts with no duration in them, or with a duration
   that fits no day. Nothing repeats until the whole pool has been spent.

   Neither list ever mentions this app. ------------------------------------- */
"use strict";

/* Keyed to an exact day count. Days 1 to 100 are covered with no gaps. Past
   that, only the numbers worth arriving at. An unkeyed day borrows from POOL. */
const DAYS = {
  1:  "The Anglo-Zanzibar War of 1896 lasted 38 minutes. You have already outlasted a war.",
  2:  "Vesuvius took about two days to bury Pompeii in AD 79. Most of the city died in the first fifteen minutes of the second morning.",
  3:  "Apollo 11 took three days just to reach the Moon.",
  4:  "The Great Fire of London burned for four days in 1666 and destroyed 13,200 houses. Six people are recorded as having died.",
  5:  "The Titanic's maiden voyage, and only voyage, lasted four days and fourteen hours.",
  6:  "The Six-Day War. You have matched it.",
  7:  "Ranulph Fiennes ran seven marathons on seven continents in seven days, aged 59, four months after a heart attack and a double bypass.",
  8:  "Apollo 11 went to the Moon and came back in 8 days, 3 hours and 18 minutes. You have now been at this longer than the entire Moon landing.",
  9:  "The Rutan Voyager flew around the world without landing or refuelling in 9 days and 3 minutes, in 1986. The cabin was the size of a phone box.",
  10: "Every taste bud on your tongue has been replaced since you started. They turn over roughly every ten days.",
  11: "Randy Gardner stayed awake for 11 days in 1964 for a school science fair. The record was retired as too dangerous to attempt.",
  12: "Apollo 17, the last time anyone left low Earth orbit, lasted 12 days and 14 hours. Nobody has been back since 1972.",
  13: "The Cuban Missile Crisis lasted thirteen days in October 1962. Nobody slept much.",
  14: "A fortnight. The Moon has gone from full to new since you started.",
  15: "Hannibal took fifteen days to cross the Alps in 218 BC. Thirty-seven elephants went in and one survived the first winter in Italy.",
  16: "Shackleton's open-boat voyage to South Georgia covered 1,300 km of the Southern Ocean in 16 days, navigating by four sextant sightings.",
  17: "The 33 Chilean miners spent 17 days trapped before anyone above ground knew they were alive.",
  18: "Louis Washkansky, the first man to receive a transplanted heart, lived 18 days. The surgeon tried again a month later and that patient lived nineteen months.",
  19: "The first Tour de France, in 1903, ran six stages over nineteen days. Riders were forbidden any help, so they carried spare tyres around their shoulders and repaired their own bikes at night.",
  20: "A human heart starts beating at about twenty days, before there is a brain to notice it.",
  21: "Apollo 11's crew were quarantined for 21 days on their return, in case the Moon carried something. The trailer they sat in is in the Smithsonian.",
  22: "Sputnik transmitted for three weeks, then its batteries died and it went round in silence for three months more.",
  23: "The Tour de France covers about 3,500 km over 23 days, with two rest days in it.",
  24: "A monarch butterfly in summer lives about three weeks. The generation that migrates to Mexico lives eight months, and nobody knows how it finds a forest it has never seen.",
  25: "The Sun has rotated once at its equator. It takes 25 days there and 35 at the poles. It is not solid, so it does not spin as one piece.",
  26: "The outer layer of your skin has completely replaced itself. The cell on the surface of your forearm right now started at the bottom of the epidermis a month ago and died on the way up.",
  27: "The Moon has completed one full orbit of Earth since you started. It takes 27.3 days.",
  28: "Skylab 2 spent 28 days in orbit in 1973, then a record. The crew had to fix the station's torn sunshade by hand before they could live in it.",
  29: "A lunar month is 29.5 days. Twelve of them fall eleven days short of a solar year, which is why Ramadan walks backwards through the seasons.",
  30: "A month in orbit and your spine is measurably longer. Astronauts come back up to 5 cm taller and lose all of it within days of standing up.",
  31: "A rabbit's pregnancy is 31 days. Some mammals can also pause one, holding a fertilised egg in suspension for months until the season is right.",
  32: "A month in orbit costs about one percent of the bone in your hips, which is what a person on Earth loses in a year.",
  33: "Lindbergh crossed the Atlantic alone in 33 hours 30 minutes, awake the entire way, with no forward windscreen. He navigated with a periscope.",
  34: "Amundsen reached the South Pole 34 days ahead of Scott, and had planned every one of those days for years.",
  35: "The first five weeks of any strength program is mostly your nervous system learning to use what you already have. New muscle shows up after that.",
  36: "Iwo Jima was planned for five days and took thirty-six.",
  37: "Columbus took 36 days to cross from the Canary Islands to landfall in 1492. You just made the crossing.",
  38: "Magellan's fleet needed 38 days just to get through the strait that now carries his name.",
  39: "A sailing packet crossed the Atlantic westbound in about forty days in 1820, into the wind and the Gulf Stream. Eastbound took twenty-five. The ocean is not symmetrical.",
  40: "Forty days. Noah's flood, the Lenten fast, and roughly the outer limit of what a healthy person survives without food.",
  41: "A bluefin tuna crosses the Atlantic in about six weeks, and comes back to spawn in the sea where it was born.",
  42: "The fastest solo sail around the world is 42 days and 16 hours, Francois Gabart, 2017. Alone, no stops, no help.",
  43: "An ostrich egg takes 42 days to hatch, twice a chicken's. Its yolk is the largest single cell any animal makes.",
  44: "A tendon takes about six weeks to regain what a muscle regains in two. Tendons have almost no blood supply, so they heal on a different clock than everything attached to them.",
  45: "Six weeks in a cast and the muscle around the break is visibly smaller. It comes back faster than it left, because the nuclei you built stay behind.",
  46: "The fastest anyone has run across the United States is 46 days: 5,000 km, more than two and a half marathons a day, every day, in 1980.",
  47: "Vicksburg held out 47 days and surrendered on the fourth of July, 1863. The town did not officially celebrate Independence Day again for eighty-one years.",
  48: "Set adrift from the Bounty with eighteen men, no chart and one sextant, Bligh sailed an open boat 6,700 km in forty-seven days.",
  49: "Tibetan Buddhism gives the dead forty-nine days between one life and the next, and the living read aloud to them the whole time.",
  50: "The Sun has now turned twice since you started.",
  51: "Light that left the Sun on your first morning is nine thousand times further from it than you are, and still nowhere near another star.",
  52: "The Self-Transcendence 3100 covers 5,000 km around one city block in Queens. The cutoff is 52 days, which works out to 96 km a day.",
  53: "Diana Nyad swam Cuba to Florida at 64, on her fifth attempt, 177 km in 53 hours, without a shark cage.",
  54: "Two months in bed and you lose about a fifth of your muscle. NASA pays volunteers to lie there tilted head down, because it is the cheapest way to study what orbit does to a body.",
  55: "The foreign legations in Peking held out under siege from 20 June to 14 August 1900. Hollywood called the film 55 Days at Peking and got the number right.",
  56: "Eight weeks after a heart attack the scar is finished and permanent. Heart muscle does not grow back, so the wall simply stays thinner where it died.",
  57: "Eight weeks of doing nothing and a trained athlete has lost most of the aerobic adaptation and almost none of the strength. The heart deconditions far faster than the muscle.",
  58: "Eight weeks is the standard lead time from a factory in Shenzhen to a shelf in Quebec: about thirty days at sea and the rest in ports and trucks.",
  59: "Skylab 3 spent 59 days in orbit in 1973 and the crew came home in better shape than the crew before them, because they had finally been given something to train on.",
  60: "Lindbergh's Spirit of St. Louis was designed, built and flown in sixty days, by a company that had never made anything like it.",
  61: "Honey crystallises in a jar after a couple of months and never spoils. Jars found sealed in Egyptian tombs were still edible.",
  62: "A tomato seed becomes a ripe tomato in about sixty days of good sun. The plant spends the first half building the factory and the second half using it.",
  63: "Michel Siffre spent two months alone in a glacier cave in 1962 with no clock. He came out on 14 September convinced it was 20 August.",
  64: "Two men stayed airborne over Las Vegas for 64 days in 1958, refuelled twice a day from a moving truck. Nobody has flown longer without landing.",
  65: "An emperor penguin egg takes about 65 days to hatch, and the male holds it on his feet the entire time without eating.",
  66: "The famous figure for forming a habit is 66 days. The study it comes from actually found a range from 18 to 254.",
  67: "Mount St Helens gave two months of warning in 1980. The north face bulged outward a metre and a half every day and everyone could see it. Nobody knew what it meant.",
  68: "A rattlesnake replaces a broken fang in about ten weeks, and carries a spare behind every one it uses.",
  69: "The 33 Chilean miners were underground 69 days, from the cave-in to the last man out of the rescue capsule.",
  70: "A nuclear submarine patrol runs about seventy days. The reactor could go twenty years without refuelling. It is the food and the crew that set the schedule.",
  71: "Ten weeks after a burn the new skin is still red and raised, and it will keep remodelling for two years. Healing is not an event, it is a schedule.",
  72: "The 1972 Andes survivors held out 72 days at 3,600 m. The search was called off on day 8.",
  73: "Nellie Bly went around the world in 72 days in 1889 with one dress and a single bag, to prove Verne's eighty beatable.",
  74: "The Falklands War lasted 74 days.",
  75: "The Siege of Leningrad lasted 872 days. You are at day 75 of something considerably more pleasant.",
  76: "Steven Callahan drifted 76 days alone across the Atlantic in a life raft in 1982, after a whale holed his boat in the night.",
  77: "A chicken embryo needs 21 days, a human 280, and a Greenland shark is not able to reproduce until it is 150 years old. The clock runs at wildly different speeds depending on what is being built.",
  78: "The fastest anyone has cycled around the world is 78 days, unsupported, averaging more than 300 km a day.",
  80: "Around the World in Eighty Days. Verne's number was a genuine 1872 estimate, not a fantasy. A journalist did it in 72 in 1889.",
  83: "Sojourner, the first Mars rover, was designed to last seven days. It ran for 83.",
  84: "The Skylab 4 crew spent 84 days in orbit and took an unscheduled day off, radio switched off, because the ground had scheduled them past what a person can hold. Every mission since has had protected time.",
  88: "Mercury has gone all the way around the Sun. Its entire year is 88 Earth days.",
  90: "Three months in: the platelets in your blood have turned over about thirty times, and the red cells not quite once.",
  95: "The Hundred Days Offensive that ended the First World War actually ran 95.",
  79: "A wandering albatross sits on its egg for 79 days, longer than any other bird, the pair taking turns in shifts of a week at a time.",
  81: "A kiwi egg takes about 80 days to hatch and fills a quarter of the mother's body. She stops eating for the last few days because there is no room left inside her.",
  82: "A sperm cell takes about eighty days to go from stem cell to finished. Anything that damages the production line takes that long to show, and that long to clear.",
  85: "A blood test for average sugar looks back three months, because the marker rides on red blood cells and they live 120 days. You cannot cram for it.",
  86: "Twelve weeks is the standard length of a training study, which is most of the reason almost nothing is known about what happens in month four.",
  87: "The Deepwater Horizon well flowed for 87 days before anyone managed to cap it.",
  89: "A cut nerve grows back at about a millimetre a day. That is why a hand injury is measured in months and a skin injury in weeks.",
  91: "A quarter of a year, and the length of one season to within a couple of days. Earth does not orbit at a constant speed, so northern summer runs about five days longer than northern winter.",
  92: "A lithium battery left sitting at full charge for three months takes damage it never gets back, which is why every device ships at about forty percent.",
  93: "The Mars rovers Spirit and Opportunity were built to last 90 days. Opportunity ran for fifteen years and stopped because a dust storm blocked the Sun.",
  94: "The first nonstop flight around the world took 94 hours in 1949, refuelled four times in the air by other aircraft.",
  96: "Three months is how long a queen bee needs to replace every worker in the hive. She lays two thousand eggs a day and they live six weeks, so the colony you see in August shares no members with the one you saw in May.",
  97: "Gym attendance data has the same shape every year: a spike on 1 January, a collapse through February, and a floor by mid-April that never recovers.",
  98: "Magellan's Pacific crossing took 98 days. They ran out of food around day forty and ate the leather off the rigging.",
  99: "Amundsen's round trip from base camp to the South Pole and back took 99 days. He came home having gained weight.",
  100: "Napoleon's return from Elba to Waterloo is remembered as the Hundred Days. It was actually 111.",
  101: "The Kon-Tiki drifted 6,900 km across the Pacific in 101 days on balsa logs lashed with rope, because Heyerdahl refused to use wire.",
  110: "A lion is pregnant for 110 days, a tiger for 105, a house cat for 64. Big cats do not take much longer than small ones.",
  115: "An emperor penguin male fasts about 115 days across courtship, laying and incubation, standing in the dark at forty below with an egg on his feet.",
  120: "Every red blood cell in your body has been replaced since day one. Not one of them was there when you started.",
  125: "Mir's first crew stayed 125 days in 1986. Mir itself was built for five years and stayed up for fifteen.",
  128: "Viking 1 was built to last 90 days on Mars and sent data for six years, until someone on Earth uploaded a bad command and killed the antenna.",
  148: "Scott's polar party was out 148 days and died 18 km from a supply depot they had stocked themselves.",
  150: "Your liver has replaced itself since you started. It turns over roughly every 150 days, and it is the only organ you have that will regrow from a fragment.",
  165: "An ISS rotation is about six months, and that number was chosen because it is roughly where bone loss starts outrunning what exercise can hold.",
  176: "A day on Mercury lasts 176 Earth days, twice its own year.",
  180: "Half a year. Earth has carried you about 470 million km around the Sun since you started.",
  182: "Winter at the South Pole runs 182 days without a sunrise, and for eight months of it no aircraft can reach the station.",
  205: "Michel Siffre went back underground in 1972 and stayed 205 days in a Texas cave. With no daylight his body drifted onto 48-hour days and he never noticed.",
  225: "Venus has completed one orbit of the Sun. Its year is 225 Earth days. Its day is 243.",
  243: "One Venusian day. Venus spins so slowly that its day outlasts its year, and it spins backwards.",
  252: "The First Fleet spent 252 days at sea getting to Australia in 1788 and lost 48 people out of 1,400. That was considered a triumph of shipboard health at the time.",
  259: "A Hohmann transfer to Mars takes about 259 days. If you had left Earth the morning you started, you would be arriving today.",
  280: "A human pregnancy, first day to due date.",
  300: "A common swift can stay airborne for ten months without landing. It eats, drinks, mates and sleeps in the air.",
  312: "Robin Knox-Johnston finished the first solo nonstop lap of the world in 312 days, the only one of nine starters to come back at all.",
  340: "Scott Kelly spent 340 consecutive days aboard the ISS. You have matched him, without the radiation.",
  365: "One year. Earth is back exactly where it started. You are not.",
  370: "The Long March covered 9,000 km in 370 days. About one in ten of the people who set out arrived.",
  400: "Longer in a row than any human has spent in space, with one exception.",
  437: "You have now matched Valeri Polyakov's 437 days aboard Mir. Nobody has beaten that since 1995."
};

/* The bonus line. No duration, or a duration that fits no day. Indexed so they
   never repeat until the pool is spent. */
const POOL = [
  "The 1928 Olympics ran the 800 m for women, then banned it for 32 years because the finishers looked tired.",
  "The deepest hole ever drilled reached 12.26 km after 20 years. The crust is 35 km thick.",
  "Usain Bolt's top speed was 44.7 km/h, held for about a fifth of a second. Nobody has beaten it since 2009.",
  "Krakatoa erupted in 1883 loud enough to be heard 4,800 km away, and burst the eardrums of sailors 64 km out.",
  "Wilhelm Rontgen discovered X-rays on 8 November 1895 and had imaged his wife's hand within weeks. She said: I have seen my death.",
  "Twelve men have walked on the Moon. One day each.",
  "The Berlin Wall went up in a single night in August 1961 and stood for 10,315 days.",
  "The Enigma code was broken, rebroken and broken again for six years. Turing's machines ran through 15 billion billion settings.",
  "D-Day put 156,000 men across 80 km of beach in a single day. Planning it took over a year.",
  "The Wright brothers' four flights on 17 December 1903 totalled 98 seconds in the air. All of powered flight starts there.",
  "Douglas Adams' answer to everything was 42. He said he chose it because it was a completely ordinary number.",
  "The longest anyone has held their breath is 24 minutes 37 seconds.",
  "Kilian Jornet climbed Everest twice in one week in 2017, without supplemental oxygen and without fixed ropes.",
  "Apollo 13 launched, was crippled and was home again in five days and twenty-two hours.",
  "Magellan's expedition took three years. One ship of five came home, carrying 18 of the 270 men who left.",
  "The Hindenburg crossed the Atlantic in about 60 hours, three times faster than any ship afloat. Thirty-seven people died in 34 seconds and that was the end of airships.",
  "A radio command to Voyager 1 takes about 23 hours to arrive, so a conversation with it takes two days.",
  "The outer layer of your cornea replaces itself about every ten days, which is why a scratched eye heals overnight.",
  "Valentina Tereshkova orbited Earth 48 times over three days in 1963. That was more flight time than every American astronaut combined at that point.",
  "A diving blue whale's heart beats about twice a minute.",
  "Gettysburg was three days. Waterloo was one.",
  "About ten percent of your skeleton is under active reconstruction at any moment. The full turnover takes ten years and it never stops.",
  "Your body has produced about two million red blood cells in the time this session took.",
  "The Voyager Golden Record is expected to remain playable for a billion years. Nothing else humans have made comes close.",
  "An octopus has nine brains and blue blood, and two thirds of its neurons are in its arms.",
  "The 1904 Olympic marathon was won by a man who was driven eleven miles of it. He was disqualified, and second place had been taking strychnine.",
  "Tardigrades survive vacuum, 150 C, and 1,000 times the radiation that kills a human. They have been to space and come back fine.",
  "A hummingbird's heart runs at 1,200 beats a minute in flight and 50 while it sleeps.",
  "The Great Wall is not visible from space with the naked eye. Airport runways are.",
  "Hannibal crossed the Alps with 37 elephants in 218 BC. One survived the first winter in Italy.",
  "Your bones are being dismantled and rebuilt continuously. The skeleton you have now is roughly ten years old.",
  "Concorde flew Heathrow to JFK in 2 hours 52 minutes. Nothing has flown that route faster since it retired in 2003.",
  "The Antikythera mechanism modelled the heavens with 30 bronze gears in about 100 BC. Nothing that intricate reappeared for 1,400 years.",
  "A single bolt of lightning carries about a billion joules, delivered in 30 microseconds.",
  "Emperor penguins hold a huddle in minus 60 C winds for two months without eating, rotating so nobody stays on the outside.",
  "The Dutch cyclist Fred Rompelberg hit 268 km/h on a bicycle in 1995, drafting behind a dragster on the Bonneville flats.",
  "Light takes 100,000 years to cross our galaxy and 8 minutes to reach you from the Sun.",
  "The Roman army marched 30 km a day carrying 30 kg, then built a fortified camp every single night.",
  "There are more possible arrangements of a shuffled deck than atoms in our galaxy. Every shuffle you have ever done was almost certainly a first.",
  "Mount Everest grows about 4 mm a year. The Himalayas are still colliding.",
  "A blue whale's aorta is wide enough for a human to crawl through.",
  "The last woolly mammoths were alive on Wrangel Island while the Great Pyramid was already standing.",
  "The Sun loses four million tonnes of mass every second, converting it to the light you feel on your face.",
  "Eddy Merckx set the hour record in 1972, then said it was the hardest ride of his life and never attempted it again.",
  "Your stomach lining replaces itself every three to five days, because otherwise it would digest itself.",
  "The 1914 Christmas truce involved about 100,000 men along the Western Front. High command banned any repeat the following year.",
  "Honeybees navigate by polarised light, and tell each other where the flowers are by dancing the angle relative to the Sun.",
  "The Chicxulub impactor was about 10 km across and released the energy of ten billion Hiroshimas in a second.",
  "The Library of Alexandria did not burn down in one night. It declined over centuries of funding cuts.",
  "A cubic metre of seawater holds about 25 kg of salt and roughly 13 billionths of a gram of gold.",
  "Wim Hof climbed to 7,200 m on Everest in shorts. Physiologists studied him for years before accepting that the breathing was doing it.",
  "Neutron star material is so dense that a teaspoon would weigh about the same as Mount Everest.",
  "The Spanish flu killed more people in 1918 than the war it followed, and the youngest and healthiest died fastest.",
  "Your eyes make about three saccades a second. Your brain deletes the motion blur between them, which is why you never see it.",
  "Genghis Khan's messengers covered 300 km a day by changing horses at relay stations across an empire 9,000 km wide.",
  "There is enough DNA in your body, uncoiled, to reach the Sun and back roughly sixty times.",
  "The Trieste reached the bottom of the Mariana Trench in 1960. Only a handful of people have been back since, and twelve have walked on the Moon.",
  "Ants have been farming fungus for 60 million years, and they weed and fertilise the crop.",
  "The Colossus at Bletchley read 5,000 characters a second in 1944. Its existence stayed secret for thirty years, so its designers got no credit while computing was invented around them.",
  "A commercial jet at cruise is closer to its stall speed than most pilots find comfortable to think about.",
  "Sharks have been around longer than trees, and longer than Saturn has had rings.",
  "A queen bee and a worker bee start as identical eggs. The only difference is what the larva is fed.",
  "The heaviest thing a human has lifted off the ground is 524 kg, and the man who did it could not walk properly for weeks.",
  "Your grip strength predicts your risk of dying of almost anything better than your blood pressure does.",
  "A cat's spine has 53 vertebrae to your 33, which is why it can turn around inside its own length.",
  "The Sahara was green four thousand years ago, with lakes and hippos. The change took a few centuries.",
  "Bone is stronger than concrete by weight, and your femur can take about 4,000 newtons before it breaks.",
  "Sound travels four times faster in water than in air, which is why you cannot tell where an underwater noise comes from.",
  "The average cumulus cloud weighs about 500 tonnes, held up by air that weighs slightly more.",
  "Every atom of iron in your blood was made in a star that exploded before the Sun existed.",
  "A giraffe's neck has seven vertebrae, the same as yours. So does a mouse.",
  "Muscle is about 20 percent protein and 75 percent water. Most of what you feel getting bigger is plumbing.",
  "Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramid.",
  "The world record for pull-ups in 24 hours is 8,940. That is one every ten seconds, awake, for a full day.",
  "Your body contains about 0.2 mg of gold, most of it in your blood.",
  "Oxford University was already teaching when the Aztec Empire was founded.",
  "A sneeze leaves your nose at about 160 km/h and the droplets can hang in the air for ten minutes.",
  "The tallest tree on Earth is 116 m and pulls water to the top by evaporation alone, against gravity, with no pump.",
  "Nobody knows why we yawn. The contagious part is well documented and completely unexplained.",
  "There is more computing power in a modern car key than in the whole of Apollo 11.",
  "The Pacific Ocean is wider than the Moon.",
  "Your fingernails grow about twice as fast on your dominant hand, and faster in summer than in winter.",
  "Bananas are slightly radioactive, and a truckload of them can set off port radiation detectors.",
  "The deepest a human has free-dived is 214 m. The lungs compress to about the size of a fist and refill on the way up."
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

/* Spread the picks across the pool instead of walking it in order. 7919 is
   prime, so stepping by it visits every free slot before repeating one. */
function poolPick(day, seenPool, skip){
  const used = seenPool || [];
  let free = POOL.map((_,i)=>i).filter(i => !used.includes(i));
  if(!free.length) free = POOL.map((_,i)=>i);
  if(free.length > 1 && typeof skip === "number"){
    const rest = free.filter(i => i !== skip);
    if(rest.length) free = rest;
  }
  return free[(day * 7919) % free.length];
}

function milestoneFor(day, seenPool){
  if(DAYS[day]) return {text: DAYS[day], keyed: true};
  const pick = poolPick(day, seenPool);
  return {text: POOL[pick], keyed: false, poolIndex: pick};
}

/* The second line. Offset the day so it never lands on the same entry the main
   line just used on an unkeyed day. */
function bonusFor(day, seenPool, skipIndex){
  const pick = poolPick(day + 1, seenPool, skipIndex);
  return {text: POOL[pick], poolIndex: pick};
}

function breakMessage(lastIndex){
  let i = (typeof lastIndex === "number" ? lastIndex + 1 : 0) % BREAKS.length;
  return {text: BREAKS[i], index: i};
}
