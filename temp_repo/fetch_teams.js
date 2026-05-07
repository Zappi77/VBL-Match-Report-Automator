
async function fetchTeams() {
  const url = 'https://www.volleyball-bundesliga.de/cms/home/2_bundesliga_frauen/2_bundesliga_frauen_pro/mannschaften.xhtml';
  const response = await fetch(url);
  const text = await response.text();
  
  const regex = /teamId=(\d+)/g;
  let match;
  const ids = new Set();
  while ((match = regex.exec(text)) !== null) {
    ids.add(match[1]);
  }
  
  const teams = {};
  for (const id of ids) {
    const index = text.indexOf(`teamId=${id}`);
    const after = text.substring(index, index + 2000);
    const nameMatch = after.match(/class="samsCmsComponentBlockHeader">([^<]+)/);
    if (nameMatch) {
      teams[nameMatch[1].trim()] = id;
    }
  }
  
  console.log('Teams:', JSON.stringify(teams, null, 2));
}

fetchTeams().catch(console.error);
