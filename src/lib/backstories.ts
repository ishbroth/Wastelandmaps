// The history and the present of the world's best-known places: the ones with a permanent snapshot (by Wikidata id) and the other famous landmarks
// (by name, see famous.ts). Written as the wasteland tells it now.

import { famousByName } from './famous';

/** The landmarks with a permanent snapshot, by Wikidata id. */
export const FREE_STORIES: Record<string, string> = {
  Q243: "Paris lost its tower in the first hour of the war. The iron lattice that drew seven million visitors a year now lies across the Champ de Mars like a dropped toy, and the people who live along the Seine call what is left the Needle. Climbers say you can still see the glow of the old city from the broken stump.",
  Q9202: "A gift from France, she watched over New York harbor for a hundred and thirty-nine years. The torch and its arm lie in the rubble at her feet now, and the copper skin has split to show the iron frame Gustave Eiffel built inside her. Harbor gangs swear she still points the way to something.",
  Q5317: "Built for the 1962 World's Fair as a picture of the future, the Space Needle spent sixty years as Seattle's postcard. The saucer sagged in the first week of the war, and what remains leans over Lower Queen Anne like a drunk. Scavengers say the elevator cables in the shaft still hold, if you trust them.",
  Q41225: "The Great Bell struck one last hour before the Elizabeth Tower snapped in half. The upper clock stage lies across the ruined Palace of Westminster with its face shattered, and nobody can agree what time it stopped at. Londoners still set their watches by it out of habit.",
  Q45178: "Jørn Utzon's white sails took sixteen years to build and about a minute to ruin. Several of the shells have caved in, the tiled roofs are full of holes, and the harbor wind plays the broken ribs like an organ.",
  Q79961: "He stood thirty meters tall over Rio de Janeiro with his arms open for nearly a century. One arm lies on the platform now and the soapstone body is cracked and full of holes, but the figure still leans out over Corcovado, welcoming whatever climbs the mountain.",
  Q133274: "Eight centuries of Russian power in red brick. The spires are snapped off, long stretches of the wall have fallen, and the golden onion domes are dented and black. Whoever holds the Kremlin holds what is left of Moscow, and has for as long as anyone alive remembers.",
  Q2636724: "A mission that became a fortress that became a shrine. In 1836 a few hundred men held it for thirteen days against an army; now its famous curved gable is half gone and its limestone walls are pocked with holes. San Antonio still remembers it, and still fights over it.",
  Q12495: "At 828 meters it was the tallest thing ever built. The upper half has fallen across Dubai in pieces the size of city blocks, and the stump still burns on windless nights. Climbers pay in caps to stand on what is left and see the glass desert below.",
  Q134883: "For thirty years the tallest free-standing structure on Earth. The shaft snapped below the pod and the whole top lies crushed across downtown Toronto. The stump is a favorite perch for anyone who wants to watch the lakeshore without being watched back.",
  Q1107297: "Lillie Coit left money to beautify San Francisco and got a fluted concrete column on Telegraph Hill for it. The crown has broken off and lies in pieces on the hillside, rebar shows through the cracks, and the murals inside are all anyone remembers.",
  Q4176: "It took six hundred and thirty-two years to finish and survived the bombs of the last great war, but not this one. One spire has punched through the nave, the other is full of holes, and the stained glass lies in bright drifts on the floor.",
  Q1542408: "Santiago's glass giant, the tallest tower in South America, built to ride out earthquakes. The top third lies crushed in the street and the facade hangs in sheets, but the frame that was made to survive anything is still standing.",
  Q9188: "Built in four hundred and ten days during the Depression to prove a point. The spire and the top third have fallen into Fifth Avenue, and what remains is blackened and torn open down one side. New Yorkers still give directions by it.",
  Q1052042: "Spaceship Earth was a monument to the future inside a theme park. Most of its silver panels are gone and the bare frame sinks into the rubble, still tilting toward a world that never came.",
  Q5853834: "Panama City's twisting tower, the Revolution Tower, turned a full quarter turn from base to crown. The spiral facade is torn open and the upper floors have collapsed; the street below glitters with glass.",
  Q2027162: "St. Louis built the Gateway Arch to point the way west: 630 feet of stainless steel over the Mississippi. One leg still curves up from the riverbank, but the top has fallen in two pieces, and nobody has found a way to point anywhere since.",
  Q44440: "International Orange against the fog, for eighty-odd years the most photographed bridge in the world. The main span has fallen into the strait, and the two towers stand over the water with their cables trailing in the wind.",
  Q1563940: "Johannesburg's slender broadcast tower looked down on Hillbrow, a neighborhood that never slept. The pod and the antenna crushed the streets below when the shaft snapped, and the broken stump leans over a place that still doesn't sleep.",
  Q180376: "It began as an advertisement for a hillside housing development and read HOLLYWOODLAND. Most of its nine letters have snapped off their frames and tumbled down Mount Lee, and only a couple still stand, bent and full of holes.",
  Q390028: "A few men signed their names to a very large idea in this brick hall in 1776. The steeple has fallen through the roof and the walls are cracked open, but Philadelphia still comes here when it has something to argue about.",
  Q6506496: "Columbus's Art Deco jewel was the tallest building in Ohio for fifty years. The spire has snapped off and lies crushed in the street, the stepped upper floors have collapsed, and the limestone is blackened.",
  Q831389: "Buenos Aires raised its white obelisk on the widest avenue in the world. It snapped in two, the top lies cracked on the pavement, and the jagged stump stands over a wrecked and overgrown 9 de Julio.",
  Q3177225: "Atlanta's glass cylinder, once the tallest hotel in the world. The revolving crown at the top fell and lies crushed below, the glass has blown out in huge sections, and one side is open to the weather.",
  Q223207: "Shanghai's pink spheres on their slender legs were meant to look like pearls dropped on a jade plate. The upper spheres fell and burst in the street, the surviving ones are cracked open, and the legs lean.",
  Q83063: "Kuala Lumpur's twin towers held the record for the tallest buildings in the world. One has collapsed halfway, the other leans badly, and the sky bridge that joined them is gone.",
  Q39054: "It leaned for eight hundred years and everyone was sure it would finally stop leaning. It did: it fell. The tower lies broken in huge sections across the grass of the Piazza dei Miracoli.",
  Q179191: "Cleveland's glass pyramid by I. M. Pei was the shrine of rock and roll. The pyramid is shattered and the lakefront is covered in glass, though somebody still plays an old guitar in the ruins at night.",
  Q756452: "New Orleans's shelter of last resort, hit by a flood once before and by a great deal more this time. The great dome has caved in, half the outer wall is gone, and the stadium is flooded and open to the sky.",
  Q9141: "Shah Jahan built it as a love letter in marble. The central dome has caved in, the minarets have fallen or lean, and the reflecting pool is choked with rubble and dead weeds.",
  Q183536: "Orange and white lattice, taller than the Eiffel Tower it was modeled on. It buckled at the middle and the upper half lies across the streets of Shiba, the antenna snapped off.",
  Q178114: "The tallest masonry structure ever built, finished after thirty-six years and a war. The obelisk snapped in half, the top lies broken across the reflecting pool, and the stump is cracked and jagged.",
  Q29294: "The Sears Tower, a hundred and ten stories, the tallest building in the world for twenty-five years. The upper third has collapsed, a huge gash runs down one side, and the Loop lies buried beneath the debris.",
};

/** The other world-famous landmarks, by their name in famous.ts. */
const FAMOUS_STORIES: Record<string, string> = {
  'Notre-Dame de Paris': "Nine centuries of Paris stood on this island, and its towers outlasted a revolution, a fire and two world wars. Now the rose window is gone, the nave is open to the sky, and the gargoyles look down on a city that no longer needs saying its prayers aloud.",
  'Tower of London': "Prisoners, kings, a menagerie and the crown jewels all lived behind these walls. The White Tower is cracked open now and the ravens that supposedly kept Britain from falling have long since left.",
  'Tower Bridge': "The bridge that lifted for ships and walked for pedestrians for a century. Both bascules hang open and rusted, the walkway between the towers is half gone, and the Thames runs red in the evening under it.",
  'Brooklyn Bridge': "Finished in 1883 after a decade and the lives of the men who built it. Several of its cables have snapped and the roadway sags, but the Gothic stone towers still hold, and traders still cross at their own risk.",
  'Pyramids of Giza': "The last of the Seven Wonders, four and a half thousand years old and untouched by every empire that came for it. The war scorched the sand around them but the stone shrugged it off, and the Sphinx still keeps its secret.",
  'London Eye': "Built to see out the millennium, it carried millions slowly over the Thames. The wheel has buckled and hangs lopsided over the water, and a few capsules still sway in the wind with something living inside.",
  'Chrysler Building': "Art Deco's greatest tower, finished in 1930 with a stainless steel crown that glittered over Midtown. The spire is bent over and the eagles on the corners stare out blind, but the crown still catches the sun.",
  'Colosseum': "Fifty thousand Romans watched gladiators die here. The arcades have fallen further now, the arena floor is a pit of rubble, and the people of the new Rome still gather in it for blood sport, as they always did.",
  'Sagrada Família': "Gaudí's unfinished cathedral was still being built a hundred and forty years after the first stone. The last spires never rose, and now never will; the finished ones are pocked and leaning over Barcelona.",
  'Louvre Museum': "The largest museum in the world, once a palace. The glass pyramid is shattered, the galleries are open to the rain, and what hung on its walls is either gone or lying in pieces in the courtyard.",
  'Buckingham Palace': "Seven hundred rooms and a balcony the world watched. The front is blackened and scarred, the flag pole is down, and whoever lives in it now keeps the gates closed.",
  'Brandenburg Gate': "A symbol of a divided city and then a united one. The columns still stand and the chariot on top has lost its horses, and Berliners meet under it as they always have.",
  'Parthenon': "Twenty-five centuries old and it has been a temple, a church, a mosque and an arsenal. The columns that survived Venetian cannon fire have survived this too, mostly.",
  'Hagia Sophia': "For a thousand years the largest cathedral in the world, then a mosque, then a museum. The great dome is cracked but holds, and the minarets lean against the sky over Istanbul.",
  "Saint Basil's Cathedral": "Ivan the Terrible reportedly blinded its architect so he could never build anything lovelier. The painted onion domes are blackened and dented, but the colors still show through the soot.",
  'White House': "The most guarded house in the world, home to every president since 1800. The portico is blackened, the walls are scorched, and the people living in it now answer to nobody.",
  'Lincoln Memorial': "Abraham Lincoln sat here, nineteen feet tall in marble, looking down the Mall. The columns are cracked, the roof has fallen in on one side, and the seated figure still looks out over the ruins of the nation he held together.",
  'Sydney Harbour Bridge': "The Coathanger. Its steel arch carried Sydney across the harbor for ninety years and the arch still stands, though the roadway has fallen away in long stretches into the water below.",
  'Hoover Dam': "Built in the Depression to turn the Colorado River into power. The concrete is cracked and stained, the lake behind it has fallen, and the great turbines still hum faintly on some nights.",
  'Times Square': "The crossroads of the world, lit like day all night. The screens are dark and shattered now, the signs hang by their wires, and the crowds that used to fill it are only echoes between the towers.",
  'Grand Central Terminal': "The great hall's ceiling had the constellations painted backwards, and nobody minded. The painted sky is peeling and the arched windows are blown out, but the clock over the information booth still stands.",
  'Rockefeller Center': "Nineteen Art Deco buildings built during the Depression, and the Rockefeller Plaza rink at their feet. The plaza is a field of broken stone and the golden Prometheus lies on his side.",
  'Forbidden City': "Twenty-four emperors lived behind these red walls and almost nobody else was allowed to enter. The roofs have fallen in on the halls, the gold is stripped from the doors, and the gates stand open at last.",
  'Alcatraz Island': "The Rock, the most famous prison in America, set in cold water that no one ever swam. The cell blocks are gutted and the lighthouse is dark, but the island still keeps its prisoners.",
  "St. Peter's Basilica": "Michelangelo's dome over the largest church in Christendom. The colonnade of Bernini's embracing arms is cracked and broken, and the dome stands, scarred, over a square that no longer holds a crowd.",
  'Trevi Fountain': "Visitors threw coins over their shoulders to guarantee a return to Rome. The basin is dry now and choked with silt, and under the broken statuary there are still coins, millions of them, worthless and bright.",
  'Pantheon': "Almost two thousand years old with a dome still wider than any built before the twentieth century. The oculus is open to the weather and the doors have been ripped away, but the stone has held.",
  'Westminster Abbey': "Coronations and royal burials for a thousand years. The western towers are cracked and the great windows are gone, and the dead of England lie in a nave open to the rain.",
  'Sacré-Cœur': "The white basilica on Montmartre overlooks all of Paris. The domes are cracked and stained gray, and the stone is dingy now, but it still shines a little at dawn.",
  'Atomium': "A model of an iron crystal, a hundred and sixty billion times larger, built for the 1958 World's Fair. Several spheres have fallen into the park and the survivors hang by their tubes.",
  'Charles Bridge': "Prague's stone bridge, standing since the 14th century with thirty statues of saints along its sides. Most of the saints have fallen into the Vltava, and the arches still carry everything that wants to cross.",
  'Milan Cathedral': "Six centuries to build and thousands of statues on the roof. Many of the pinnacles have fallen and the great facade is blackened, but the stone forest on the roof is still crowded.",
  'Rialto Bridge': "The oldest bridge over the Grand Canal, lined with shops for five hundred years. Half the shops are gone, the arch is cracked, and the canal beneath it has turned the color of tea.",
  'United States Capitol': "Where the laws were written and, now, the loudest arguments are held. The dome is scorched and cracked, the Statue of Freedom lies on the east steps, and the people who live in it hold their own kind of session.",
};

/** The history of a famous place, if it has one written. */
export function backstoryFor(spotId: string, realName: string | null): string | null {
  if (spotId.startsWith('wd:') && FREE_STORIES[spotId.slice(3)]) return FREE_STORIES[spotId.slice(3)];
  const famous = realName ? famousByName(realName) : undefined;
  if (famous && FAMOUS_STORIES[famous.name]) return FAMOUS_STORIES[famous.name];
  return null;
}
