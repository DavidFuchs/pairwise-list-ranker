import { stringify as stringifyYaml } from 'yaml';

import type { FieldRoles, SourceFormat } from '@/types/source';

/** Ready-made data for trying the ranker without typing or importing anything. */
export interface Sample {
  id: 'songs' | 'movies' | 'games';
  /** What the button says. */
  label: string;
  /** What arrives, and in which format, so loading one is no surprise. */
  detail: string;
  format: SourceFormat;
  text: string;
  /** Where the list sits in the document. */
  path: string[];
  /** The setup the list arrives with, chosen to show the cards off. */
  roles: FieldRoles;
}

export interface SampleSong {
  song_name: string;
  artist: string;
  featured_artists: string[];
  album: string;
  album_artist: string;
  release_date: string;
  genre: string;
  duration_sec: number;
  version: string;
  explicit: boolean;
  isrc: string;
  apple_music_id: string;
  deezer_id: string;
  apple_music_url: string;
  artwork_url: string;
}

/** Every field suits at least one renderer, so the sample can show them off. */
export const SAMPLE_SONGS: SampleSong[] = [
  {
    song_name: 'A Bar Song (Tipsy)',
    artist: 'Shaboozey',
    featured_artists: [],
    album: "Where I've Been, Isn't Where I'm Going",
    album_artist: 'Shaboozey',
    release_date: '2024-04-12',
    genre: 'Country',
    duration_sec: 171,
    version: 'original',
    explicit: true,
    isrc: 'USUYG1541249',
    apple_music_id: '1737085899',
    deezer_id: '2729273551',
    apple_music_url: 'https://music.apple.com/ca/album/a-bar-song-tipsy/1737085577?i=1737085899',
    artwork_url:
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/97/b5/bc/97b5bca2-6238-2421-4f0d-1f7a39d5d9d4/197342550925_cover.jpg/300x300bb.jpg',
  },
  {
    song_name: 'Cold Heart (PNAU Remix)',
    artist: 'Elton John',
    featured_artists: ['Dua Lipa'],
    album: 'Cold Heart (PNAU Remix) - Single',
    album_artist: 'Elton John & Dua Lipa',
    release_date: '2021-08-13',
    genre: 'Pop',
    duration_sec: 203,
    version: 'remix',
    explicit: false,
    isrc: 'GBUM72104705',
    apple_music_id: '1578986673',
    deezer_id: '1457025872',
    apple_music_url: 'https://music.apple.com/ca/album/cold-heart-pnau-remix/1578986656?i=1578986673',
    artwork_url:
      'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/ec/2f/92/ec2f929f-e7ea-b291-42d7-75081bd808a1/21UMGIM68484.rgb.jpg/300x300bb.jpg',
  },
  {
    song_name: 'The Future Is A Foreign Land',
    artist: 'Ghost',
    featured_artists: [],
    album: 'Rite Here Rite Now (Original Motion Picture Soundtrack)',
    album_artist: 'Ghost',
    release_date: '2024-06-21',
    genre: 'Metal',
    duration_sec: 225,
    version: 'original',
    explicit: false,
    isrc: 'USC4R2442915',
    apple_music_id: '1744433354',
    deezer_id: '2846621942',
    apple_music_url: 'https://music.apple.com/ca/album/the-future-is-a-foreign-land/1744432897?i=1744433354',
    artwork_url:
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/28/7e/37/287e370c-789a-2438-6cc7-ff74b03b5773/24CRGIM42028.rgb.jpg/300x300bb.jpg',
  },
  {
    song_name: 'Turbo Killer',
    artist: 'Carpenter Brut',
    featured_artists: [],
    album: 'Trilogy',
    album_artist: 'Carpenter Brut',
    release_date: '2015-01-19',
    genre: 'Electronic/Dance',
    duration_sec: 209,
    version: 'original',
    explicit: false,
    isrc: 'FR9W11418529',
    apple_music_id: '1440894872',
    deezer_id: '375302181',
    apple_music_url: 'https://music.apple.com/ca/album/turbo-killer/1440894748?i=1440894872',
    artwork_url:
      'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/f3/67/b9/f367b929-406d-ef08-6b62-a4322c62c8da/00602557606782.rgb.jpg/300x300bb.jpg',
  },
  {
    song_name: 'Get Lucky',
    artist: 'Daft Punk',
    featured_artists: ['Pharrell Williams', 'Nile Rodgers'],
    album: 'Random Access Memories',
    album_artist: 'Daft Punk',
    release_date: '2013-04-19',
    genre: 'Electronic/Dance',
    duration_sec: 370,
    version: 'original',
    explicit: false,
    isrc: 'USQX91300108',
    apple_music_id: '617154366',
    deezer_id: '67238735',
    apple_music_url: 'https://music.apple.com/ca/album/get-lucky/617154241?i=617154366',
    artwork_url:
      'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/300x300bb.jpg',
  },
  {
    song_name: 'ALWAYS ON MY MIND',
    artist: 'Emigrate',
    featured_artists: ['Till Lindemann'],
    album: 'THE PERSISTENCE OF MEMORY',
    album_artist: 'Emigrate',
    release_date: '2021-10-15',
    genre: 'Metal',
    duration_sec: 210,
    version: 'original',
    explicit: false,
    isrc: 'DE1AA2100002',
    apple_music_id: '1586116964',
    deezer_id: '1513103652',
    apple_music_url:
      'https://music.apple.com/ca/album/always-on-my-mind-feat-till-lindemann/1586116957?i=1586116964',
    artwork_url:
      'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/9e/b9/35/9eb935ea-01dd-ae2a-79df-aa71ab31a4dc/886449464579.jpg/300x300bb.jpg',
  },
  {
    song_name: 'Love Somebody',
    artist: 'Morgan Wallen',
    featured_artists: [],
    album: 'I’m The Problem',
    album_artist: 'Morgan Wallen',
    release_date: '2024-10-18',
    genre: 'Country',
    duration_sec: 205,
    version: 'original',
    explicit: false,
    isrc: 'USUG12406387',
    apple_music_id: '1802104403',
    deezer_id: '3040572191',
    apple_music_url: 'https://music.apple.com/ca/album/love-somebody/1802103958?i=1802104403',
    artwork_url:
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/1e/ef/26/1eef2600-29f4-5423-3052-26874afd2947/25UMGIM46050.rgb.jpg/300x300bb.jpg',
  },
  {
    song_name: 'When We Were Young',
    artist: 'Adele',
    featured_artists: [],
    album: '25',
    album_artist: 'Adele',
    release_date: '2015-11-20',
    genre: 'Pop',
    duration_sec: 291,
    version: 'original',
    explicit: false,
    isrc: 'GBBKS1500217',
    apple_music_id: '1051332394',
    deezer_id: '138546001',
    apple_music_url: 'https://music.apple.com/ca/album/when-we-were-young/1051331933?i=1051332394',
    artwork_url:
      'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/62/bc/87/62bc8791-2a12-4b01-8928-d601684a951c/634904074005.png/300x300bb.jpg',
  },
  {
    song_name: 'Suspicious Minds',
    artist: 'Elvis Presley',
    featured_artists: [],
    album: 'From Elvis In Memphis',
    album_artist: 'Elvis Presley',
    release_date: '1969-08-26',
    genre: 'Rock',
    duration_sec: 263,
    version: 'original',
    explicit: false,
    isrc: 'USRC11000806',
    apple_music_id: '1138095084',
    deezer_id: '69404840',
    apple_music_url: 'https://music.apple.com/ca/album/suspicious-minds/1138094621?i=1138095084',
    artwork_url:
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4e/18/b2/4e18b2ba-476d-d157-ab7e-9eed7a578e57/886445944754.jpg/300x300bb.jpg',
  },
  {
    song_name: 'Teenage Dirtbag',
    artist: 'Wheatus',
    featured_artists: [],
    album: 'Wheatus',
    album_artist: 'Wheatus',
    release_date: '2000-06-20',
    genre: 'Rock',
    duration_sec: 242,
    version: 'original',
    explicit: true,
    isrc: 'USSM10008431',
    apple_music_id: '298160976',
    deezer_id: '849698',
    apple_music_url: 'https://music.apple.com/ca/album/teenage-dirtbag/298160962?i=298160976',
    artwork_url:
      'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/f7/c3/33/f7c333e4-b2b5-b49d-1406-f51bdac6a8aa/mzi.bllmhdje.jpg/300x300bb.jpg',
  },
];

/**
 * The songs arrive as JSON, set up with album art beside the title, a play
 * button that tries Apple Music and then Deezer, and details drawn as tags, a
 * coloured genre, a year, a duration and a badge. Fields left out - the long
 * Apple Music link, the ISRC - are a tick away in the setup list.
 */
export const SONG_SAMPLE: Sample = {
  id: 'songs',
  label: 'Songs',
  detail: '10 songs, as JSON',
  format: 'json',
  text: `${JSON.stringify({ songs: SAMPLE_SONGS }, null, 2)}
`,
  path: ['songs'],
  roles: {
    labelField: 'song_name',
    summaryFields: [
      'artwork_url',
      'apple_music_id',
      'deezer_id',
      'artist',
      'featured_artists',
      'genre',
      'release_date',
      'duration_sec',
      'explicit',
    ],
    fieldRenderers: {
      artwork_url: 'image',
      apple_music_id: 'apple-music-preview',
      deezer_id: 'deezer-preview',
      featured_artists: 'tags',
      genre: 'pills',
      release_date: 'year',
      duration_sec: 'duration',
      explicit: 'badge',
    },
  },
};

export interface SampleMovie {
  title: string;
  year: number;
  genres: string[];
  director: string;
  /** The three leads, in billing order, matching cast_photos. */
  cast: string[];
  /** The first public showing, festival premieres included. */
  release_date: string;
  /** Where the film is from, as a two-letter country code. */
  country: string;
  filming_location: string;
  mpaa_rating: string;
  /** Out of 10, as IMDb shows it. */
  imdb_rating: number;
  /** The Tomatometer, out of 100. */
  rotten_tomatoes: number;
  /** In US dollars; absent where the budget was only ever reported in another currency. */
  budget_usd?: number;
  /** Worldwide, in US dollars. */
  box_office_usd: number;
  best_picture: boolean;
  synopsis: string;
  poster_url: string;
  trailer: string;
  cast_photos: string[];
  imdb_url: string;
}

/**
 * Picks the renderers the songs leave out. Posters are the English
 * Wikipedia's, headshots are from Wikimedia Commons, and trailers are on
 * YouTube; ratings and takings were current when the list was made. Das Boot
 * has no budget on purpose: it was reported in Deutsche Marks, and a missing
 * value shows how a card handles one.
 */
export const SAMPLE_MOVIES: SampleMovie[] = [
  {
    title: 'The Hurt Locker',
    year: 2008,
    genres: ['Military Drama', 'Thriller'],
    director: 'Kathryn Bigelow',
    cast: ['Jeremy Renner', 'Anthony Mackie', 'Brian Geraghty'],
    release_date: '2008-09-04',
    country: 'US',
    filming_location: 'Amman, Jordan',
    mpaa_rating: 'R',
    imdb_rating: 7.5,
    rotten_tomatoes: 97,
    budget_usd: 15_000_000,
    box_office_usd: 49_900_000,
    best_picture: true,
    synopsis:
      'In 2004 Baghdad, a reckless new sergeant takes over an Army bomb disposal team, and his appetite for risk unsettles the two soldiers counting down the days left in their rotation.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/6/6c/HLposterUSA2.jpg',
    trailer: 'https://www.youtube.com/watch?v=4mgWq9wZs2o',
    cast_photos: [
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/76/Jeremy_Renner_at_TIFF_2025_%28cropped%29.jpg/250px-Jeremy_Renner_at_TIFF_2025_%28cropped%29.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9c/2025_Anthony_Mackie_%28cropped%29.jpg/250px-2025_Anthony_Mackie_%28cropped%29.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Brian_Geraghty_by_David_Shankbone.jpg/250px-Brian_Geraghty_by_David_Shankbone.jpg',
    ],
    imdb_url: 'https://www.imdb.com/title/tt0887912/',
  },
  {
    title: '10 Cloverfield Lane',
    year: 2016,
    genres: ['Bottle Movie', 'Sci-Fi', 'Thriller'],
    director: 'Dan Trachtenberg',
    cast: ['Mary Elizabeth Winstead', 'John Goodman', 'John Gallagher Jr.'],
    release_date: '2016-03-08',
    country: 'US',
    filming_location: 'New Orleans, Louisiana',
    mpaa_rating: 'PG-13',
    imdb_rating: 7.2,
    rotten_tomatoes: 91,
    budget_usd: 15_000_000,
    box_office_usd: 110_200_000,
    best_picture: false,
    synopsis:
      'After a car crash, a young woman wakes in an underground bunker. The man who built it insists the air outside is poisoned, and she has to work out whether he saved her or is keeping her.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/0/0e/10_Cloverfield_Lane.png',
    trailer: 'https://www.youtube.com/watch?v=yQy-ANhnUpE',
    cast_photos: [
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3e/Mary_Elizabeth_Winstead_by_Gage_Skidmore.jpg/250px-Mary_Elizabeth_Winstead_by_Gage_Skidmore.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2d/John_Goodman_2014.jpg/250px-John_Goodman_2014.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/80/John_Gallagher%2C_Jr._at_PaleyFest_2013.jpg/250px-John_Gallagher%2C_Jr._at_PaleyFest_2013.jpg',
    ],
    imdb_url: 'https://www.imdb.com/title/tt1179933/',
  },
  {
    title: 'No Country for Old Men',
    year: 2007,
    genres: ['Drama', 'Crime', 'Thriller'],
    director: 'Joel and Ethan Coen',
    cast: ['Tommy Lee Jones', 'Javier Bardem', 'Josh Brolin'],
    release_date: '2007-05-19',
    country: 'US',
    filming_location: 'Marfa, Texas',
    mpaa_rating: 'R',
    imdb_rating: 8.2,
    rotten_tomatoes: 93,
    budget_usd: 25_000_000,
    box_office_usd: 171_627_166,
    best_picture: true,
    synopsis:
      'A hunter in West Texas stumbles on a drug deal gone wrong and a case full of cash. Taking it puts a relentless killer on his trail, with a weary sheriff a step behind them both.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/8/8b/No_Country_for_Old_Men_poster.jpg',
    trailer: 'https://www.youtube.com/watch?v=A0oNrgumrlE',
    cast_photos: [
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Tommy_Lee_Jones_2017.jpg/250px-Tommy_Lee_Jones_2017.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/ff/MJK_71654_Javier_Bardem_%28The_Roads_Not_Taken%2C_Berlinale_2020%29.jpg/250px-MJK_71654_Javier_Bardem_%28The_Roads_Not_Taken%2C_Berlinale_2020%29.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Josh_Brolin_TIFF_2025_%28cropped%29.jpg/250px-Josh_Brolin_TIFF_2025_%28cropped%29.jpg',
    ],
    imdb_url: 'https://www.imdb.com/title/tt0477348/',
  },
  {
    title: 'The Lord of the Rings: The Fellowship of the Ring',
    year: 2001,
    genres: ['Fantasy', 'Adventure'],
    director: 'Peter Jackson',
    cast: ['Elijah Wood', 'Ian McKellen', 'Viggo Mortensen'],
    release_date: '2001-12-19',
    country: 'NZ',
    filming_location: 'Hobbiton Movie Set, Matamata, New Zealand',
    mpaa_rating: 'PG-13',
    imdb_rating: 8.9,
    rotten_tomatoes: 91,
    budget_usd: 93_000_000,
    box_office_usd: 897_540_492,
    best_picture: false,
    synopsis:
      'A hobbit inherits a ring of terrible power and leaves the Shire with eight companions to destroy it, before its maker can take it back and cover Middle-earth in darkness.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/f/fb/Lord_Rings_Fellowship_Ring.jpg',
    trailer: 'https://www.youtube.com/watch?v=V75dMMIW2B4',
    cast_photos: [
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c9/Elijah_Wood_%2847955397556%29_%28cropped%29.jpg/250px-Elijah_Wood_%2847955397556%29_%28cropped%29.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/McKellenRichmnd040219-5_%2846275370484%29_%28cropped%29.jpg/250px-McKellenRichmnd040219-5_%2846275370484%29_%28cropped%29.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/64/Viggo_Mortensen_B_%282020%29.jpg/250px-Viggo_Mortensen_B_%282020%29.jpg',
    ],
    imdb_url: 'https://www.imdb.com/title/tt0120737/',
  },
  {
    title: 'The Banshees of Inisherin',
    year: 2022,
    genres: ['Comedy', 'Drama'],
    director: 'Martin McDonagh',
    cast: ['Colin Farrell', 'Brendan Gleeson', 'Kerry Condon'],
    release_date: '2022-09-05',
    country: 'IE',
    filming_location: 'Inis Mór, Ireland',
    mpaa_rating: 'R',
    imdb_rating: 7.6,
    rotten_tomatoes: 96,
    budget_usd: 20_000_000,
    box_office_usd: 52_300_000,
    best_picture: false,
    synopsis:
      'On a remote Irish island in 1923, a man is stunned when his lifelong friend suddenly ends their friendship, and his efforts to mend it escalate with alarming results.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/6/6e/The_Banshees_of_Inisherin.jpg',
    trailer: 'https://www.youtube.com/watch?v=uRu3zLOJN2c',
    cast_photos: [
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/72/2025_Colin_Farrell_-_2_%28cropped%29.jpg/250px-2025_Colin_Farrell_-_2_%28cropped%29.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Brendan_Gleeson.jpg/250px-Brendan_Gleeson.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f3/Kerry_Condon_during_an_interview_in_2022_%28cropped%29.jpg/250px-Kerry_Condon_during_an_interview_in_2022_%28cropped%29.jpg',
    ],
    imdb_url: 'https://www.imdb.com/title/tt11813216/',
  },
  {
    title: 'Inglourious Basterds',
    year: 2009,
    genres: ['Military Drama', 'Action'],
    director: 'Quentin Tarantino',
    cast: ['Brad Pitt', 'Christoph Waltz', 'Mélanie Laurent'],
    release_date: '2009-05-20',
    country: 'US',
    filming_location: 'Babelsberg Studio, Potsdam, Germany',
    mpaa_rating: 'R',
    imdb_rating: 8.4,
    rotten_tomatoes: 89,
    budget_usd: 70_000_000,
    box_office_usd: 321_457_747,
    best_picture: false,
    synopsis:
      'In occupied France, a squad of Jewish-American soldiers spreads fear behind enemy lines, while a young cinema owner plans her own revenge on the Nazi leadership at a film premiere.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/c/c3/Inglourious_Basterds_poster.jpg',
    trailer: 'https://www.youtube.com/watch?v=sE8hc4gVyGo',
    cast_photos: [
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Brad_Pitt_2019_by_Glenn_Francis.jpg/250px-Brad_Pitt_2019_by_Glenn_Francis.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Christoph_Waltz_at_82nd_Venice_International_Film_Festival-1_%28cropped%29.jpg/250px-Christoph_Waltz_at_82nd_Venice_International_Film_Festival-1_%28cropped%29.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c4/MKr377930_M%C3%A9lanie_Laurent_%28Qui_brille_au_combat%2C_Cannes_2025%29.jpg/250px-MKr377930_M%C3%A9lanie_Laurent_%28Qui_brille_au_combat%2C_Cannes_2025%29.jpg',
    ],
    imdb_url: 'https://www.imdb.com/title/tt0361748/',
  },
  {
    title: 'Das Boot',
    year: 1981,
    genres: ['Military Drama', 'Thriller'],
    director: 'Wolfgang Petersen',
    cast: ['Jürgen Prochnow', 'Herbert Grönemeyer', 'Martin Semmelrogge'],
    release_date: '1981-09-17',
    country: 'DE',
    filming_location: 'Bavaria Studios, Grünwald, Germany',
    mpaa_rating: 'R',
    imdb_rating: 8.4,
    rotten_tomatoes: 98,
    box_office_usd: 84_970_337,
    best_picture: false,
    synopsis:
      'A German U-boat crew sets out on patrol in the Atlantic in 1941. Weeks of cramped boredom give way to terror as the war at sea turns against them.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/a/a3/Das_boot_ver1.jpg',
    trailer: 'https://www.youtube.com/watch?v=KhNnU4h1Q50',
    cast_photos: [
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0a/MJK_60861_Verena_Wengler_und_J%C3%BCrgen_Prochnow_%28Hessischer_Film-_und_Kinopreis_2019%29_%28cropped%29.jpg/250px-MJK_60861_Verena_Wengler_und_J%C3%BCrgen_Prochnow_%28Hessischer_Film-_und_Kinopreis_2019%29_%28cropped%29.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/1LIVE_Krone_2014_Herbert_Gr%C3%B6nemeyer_1.jpg/250px-1LIVE_Krone_2014_Herbert_Gr%C3%B6nemeyer_1.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/MKr20129_Martin_Semmelrogge_%28Berlinale_2023%29.jpg/250px-MKr20129_Martin_Semmelrogge_%28Berlinale_2023%29.jpg',
    ],
    imdb_url: 'https://www.imdb.com/title/tt0082096/',
  },
  {
    title: 'Nacho Libre',
    year: 2006,
    genres: ['Comedy'],
    director: 'Jared Hess',
    cast: ['Jack Black', 'Ana de la Reguera', 'Héctor Jiménez'],
    release_date: '2006-06-16',
    country: 'US',
    filming_location: 'Oaxaca, Mexico',
    mpaa_rating: 'PG',
    imdb_rating: 5.8,
    rotten_tomatoes: 40,
    budget_usd: 35_000_000,
    box_office_usd: 99_255_460,
    best_picture: false,
    synopsis:
      'A cook at a Mexican monastery secretly wrestles as a masked luchador, hoping to win prize money for the orphans in his care and the respect of a newly arrived nun.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/7/7e/Nacho_Libre_poster.jpg',
    trailer: 'https://www.youtube.com/watch?v=5Atg2aASyY4',
    cast_photos: [
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/32/Jack_Black_KCA_2025.png/250px-Jack_Black_KCA_2025.png',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/70/Ana_de_la_Reguera_%28cropped%29.jpg/250px-Ana_de_la_Reguera_%28cropped%29.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Hector_Jimenez.jpg/250px-Hector_Jimenez.jpg',
    ],
    imdb_url: 'https://www.imdb.com/title/tt0457510/',
  },
  {
    title: 'Master and Commander: The Far Side of the World',
    year: 2003,
    genres: ['Military Drama', 'Action', 'Adventure'],
    director: 'Peter Weir',
    cast: ['Russell Crowe', 'Paul Bettany', 'Billy Boyd'],
    release_date: '2003-11-14',
    country: 'US',
    filming_location: 'Baja Studios, Rosarito, Mexico',
    mpaa_rating: 'PG-13',
    imdb_rating: 7.5,
    rotten_tomatoes: 85,
    budget_usd: 150_000_000,
    box_office_usd: 212_011_111,
    best_picture: false,
    synopsis:
      "In 1805, Captain Jack Aubrey drives his British frigate around Cape Horn after a faster, better-armed French warship, testing his crew and his friendship with the ship's surgeon.",
    poster_url:
      'https://upload.wikimedia.org/wikipedia/en/b/bf/Master_and_Commander-The_Far_Side_of_the_World_poster.png',
    trailer: 'https://www.youtube.com/watch?v=tHTHCNYiiHk',
    cast_photos: [
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a7/Russell_Crowe_on_the_Green_Carpet_at_the_2025_Zurich_Film_Festival_06_%28cropped%29.jpg/250px-Russell_Crowe_on_the_Green_Carpet_at_the_2025_Zurich_Film_Festival_06_%28cropped%29.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/be/Paul_Bettany_-_Los_Angeles_Comic_Con_2025.jpg/250px-Paul_Bettany_-_Los_Angeles_Comic_Con_2025.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/62/Billy_Boyd_%2855222129722%29_%28cropped%29.jpg/250px-Billy_Boyd_%2855222129722%29_%28cropped%29.jpg',
    ],
    imdb_url: 'https://www.imdb.com/title/tt0311113/',
  },
  {
    title: 'Star Wars IV: A New Hope',
    year: 1977,
    genres: ['Sci-Fi', 'Adventure', 'Fantasy'],
    director: 'George Lucas',
    cast: ['Mark Hamill', 'Harrison Ford', 'Carrie Fisher'],
    release_date: '1977-05-25',
    country: 'US',
    filming_location: 'Tozeur, Tunisia',
    mpaa_rating: 'PG',
    imdb_rating: 8.6,
    rotten_tomatoes: 94,
    budget_usd: 11_000_000,
    box_office_usd: 775_398_007,
    best_picture: false,
    synopsis:
      'A farm boy on a desert planet is pulled into a rebellion against the Empire when he finds a secret message hidden in a droid, and sets out to rescue a captured princess.',
    poster_url: 'https://upload.wikimedia.org/wikipedia/en/8/87/StarWarsMoviePoster1977.jpg',
    trailer: 'https://www.youtube.com/watch?v=vZ734NWnAHA',
    cast_photos: [
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8c/Mark_Hamill_by_Gage_Skidmore_5.jpg/250px-Mark_Hamill_by_Gage_Skidmore_5.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/Harrison_Ford_-_Televerse_2025-03.jpg/250px-Harrison_Ford_-_Televerse_2025-03.jpg',
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/03/Carrie_Fisher_2013-a_straightened.jpg/250px-Carrie_Fisher_2013-a_straightened.jpg',
    ],
    imdb_url: 'https://www.imdb.com/title/tt0076759/',
  },
];

/**
 * The movies arrive as YAML - the format they were first written in - set up
 * with a gallery beside the title that pages from the poster to the trailer
 * to the leads, and details drawn as tags, a date, a flag, stars, a bar, a
 * coloured rating, money two ways, a place on a map, a badge, a synopsis and
 * a link. The director, the cast's names and the year are a tick away.
 */
export const MOVIE_SAMPLE: Sample = {
  id: 'movies',
  label: 'Movies',
  detail: '10 movies, as YAML',
  format: 'yaml',
  text: stringifyYaml({ movies: SAMPLE_MOVIES }, { lineWidth: 0 }),
  path: ['movies'],
  roles: {
    labelField: 'title',
    summaryFields: [
      'poster_url',
      'trailer',
      'cast_photos',
      'genres',
      'release_date',
      'country',
      'imdb_rating',
      'rotten_tomatoes',
      'mpaa_rating',
      'box_office_usd',
      'budget_usd',
      'filming_location',
      'best_picture',
      'synopsis',
      'imdb_url',
    ],
    fieldRenderers: {
      poster_url: 'image',
      trailer: 'youtube',
      cast_photos: 'image-gallery',
      genres: 'tags',
      release_date: 'date',
      country: 'flag',
      imdb_rating: 'stars-10',
      rotten_tomatoes: 'bar-100',
      mpaa_rating: 'pills',
      box_office_usd: 'compact',
      budget_usd: 'currency-USD',
      filming_location: 'location',
      best_picture: 'badge',
      synopsis: 'long-text',
      imdb_url: 'link',
    },
  },
};

export interface SampleGame {
  title: string;
  /** The year it was game of the year, which can differ from its release. */
  year: number;
  steam_app_id: number;
  /** The banner address Steam hands out; newer games have no other. */
  steam_header: string;
  screenshots: string[];
  developers: string[];
  genres: string[];
  /** The full release on Steam, after any early access. */
  release_date: string;
  platforms: string[];
  multiplayer: boolean;
  /** The share of Steam reviews that are positive, out of 100. */
  positive_reviews: number;
  review_count: number;
  review_summary: string;
  /** Absent where Steam shows no Metacritic score. */
  metacritic?: number;
  /** The regular price, before any sale; 0 for free to play. */
  price_usd: number;
  description: string;
  store_url: string;
}

/**
 * A game of the year for each year. Everything past the title and year is
 * Steam's own: the banner, screenshots, store blurb, genres and figures were
 * current when the list was made.
 */
export const SAMPLE_GAMES: SampleGame[] = [
  {
    title: 'IRON NEST: Heavy Turret Simulator',
    year: 2026,
    steam_app_id: 2950790,
    steam_header:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2950790/e6c9e990560078611472e5dab98e79a405ed33f4/header.jpg?t=1791834023',
    screenshots: [
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2950790/be3e941061112698ad333230e045b1be84e32235/ss_be3e941061112698ad333230e045b1be84e32235.600x338.jpg?t=1791834023',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2950790/40d186452e7d1baf038ea858719f73f8542539e8/ss_40d186452e7d1baf038ea858719f73f8542539e8.600x338.jpg?t=1791834023',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2950790/c27067644522be8b011bbad116f31cb177392a7c/ss_c27067644522be8b011bbad116f31cb177392a7c.600x338.jpg?t=1791834023',
    ],
    developers: ['Nick Nieuwoudt', 'Dominik Latos'],
    genres: ['Action', 'Indie', 'Simulation'],
    release_date: '2026-08-06',
    platforms: ['Windows'],
    multiplayer: false,
    positive_reviews: 98,
    review_count: 15_253,
    review_summary: 'Overwhelmingly Positive',
    metacritic: 90,
    price_usd: 19.99,
    description:
      'IRON NEST is a brutal dieselpunk heavy-artillery game where you dominate the battlefield through a colossal war machine. Take map measurements based on the received coordinates, strain the hydraulics, and gunlay the cannons to unleash devastating blows ⟹ Will you obey High Command, Operator?',
    store_url: 'https://store.steampowered.com/app/2950790/',
  },
  {
    title: 'Blue Prince',
    year: 2025,
    steam_app_id: 1569580,
    steam_header:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1569580/879ac248a3b548a6bbc32771b950756378e7e922/header.jpg?t=1783605097',
    screenshots: [
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1569580/ss_7f4511e2454604568f545436f36674451fed6353.600x338.jpg?t=1783605097',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1569580/ss_d04f2e766f538d3680b28574ec97f06b3274aafc.600x338.jpg?t=1783605097',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1569580/ss_f35ec2c097bda6d0d1eb2846be6be0cfc4cdfcc8.600x338.jpg?t=1783605097',
    ],
    developers: ['Dogubomb'],
    genres: ['Adventure', 'Indie', 'Strategy'],
    release_date: '2025-04-10',
    platforms: ['Windows', 'macOS'],
    multiplayer: false,
    positive_reviews: 86,
    review_count: 20_454,
    review_summary: 'Very Positive',
    metacritic: 92,
    price_usd: 29.99,
    description:
      'Welcome to Mt. Holly, where every dawn unveils a new mystery. Navigate through shifting corridors and ever-changing chambers in this genre-defying strategy puzzle adventure. But will your unpredictable path lead you to the rumored Room 46?',
    store_url: 'https://store.steampowered.com/app/1569580/',
  },
  {
    title: 'Satisfactory',
    year: 2024,
    steam_app_id: 526870,
    steam_header:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/526870/header.jpg?t=1791192059',
    screenshots: [
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/526870/ss_9083ccf8fbb22c4068a6e233e3de343f815f9dc1.600x338.jpg?t=1791192059',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/526870/ss_6f456011887f970dc230af5e1720065ca3430aae.600x338.jpg?t=1791192059',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/526870/ss_b1104309f1c22c85de6ad6c401e6d889411c14d2.600x338.jpg?t=1791192059',
    ],
    developers: ['Coffee Stain Studios'],
    genres: ['Adventure', 'Indie', 'Simulation', 'Strategy'],
    release_date: '2024-09-10',
    platforms: ['Windows'],
    multiplayer: true,
    positive_reviews: 97,
    review_count: 281_313,
    review_summary: 'Overwhelmingly Positive',
    metacritic: 91,
    price_usd: 39.99,
    description:
      'Satisfactory is a first-person open-world factory building game with a dash of exploration and combat. Play alone or with friends, explore an alien planet, create multi-story factories, and enter conveyor belt heaven!',
    store_url: 'https://store.steampowered.com/app/526870/',
  },
  {
    title: 'Dredge',
    year: 2023,
    steam_app_id: 1562430,
    steam_header:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1562430/header.jpg?t=1780479732',
    screenshots: [
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1562430/ss_70f88014423ed93eaa111c0d0daca2c500f76908.600x338.jpg?t=1780479732',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1562430/ss_d4d4b14c5cd071307e27b4e9737f23f28b096248.600x338.jpg?t=1780479732',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1562430/ss_9529104cde1af2ffbb715cab42bbb3012fb9b7d8.600x338.jpg?t=1780479732',
    ],
    developers: ['Black Salt Games'],
    genres: ['Adventure', 'RPG'],
    release_date: '2023-03-30',
    platforms: ['Windows', 'macOS'],
    multiplayer: false,
    positive_reviews: 96,
    review_count: 57_533,
    review_summary: 'Overwhelmingly Positive',
    price_usd: 26.99,
    description:
      'DREDGE is a single-player fishing adventure with a sinister undercurrent. Sell your catch, upgrade your boat, and dredge the depths for long-buried secrets. Explore a mysterious archipelago and discover why some things are best left forgotten.',
    store_url: 'https://store.steampowered.com/app/1562430/',
  },
  {
    title: 'Warhammer 40,000: Darktide',
    year: 2022,
    steam_app_id: 1361210,
    steam_header:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1361210/6f8919b0183f24d271650c6dca958fb91edd5849/header_alt_assets_20.jpg?t=1790691939',
    screenshots: [
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1361210/ss_e5bfe858d549cb4c488f9f755587496deca96082.600x338.jpg?t=1790691939',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1361210/ss_623eb17524442b7a908511fb46fef3366609dbd3.600x338.jpg?t=1790691939',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1361210/ss_bb7caeef3cb174a55f6ba87b2fbeb9eb53db2dc9.600x338.jpg?t=1790691939',
    ],
    developers: ['Fatshark'],
    genres: ['Action', 'Adventure', 'RPG'],
    release_date: '2022-11-30',
    platforms: ['Windows'],
    multiplayer: true,
    positive_reviews: 72,
    review_count: 140_178,
    review_summary: 'Mostly Positive',
    price_usd: 39.99,
    description:
      'Take back the city of Tertium from hordes of bloodthirsty foes in this intense and brutal action shooter. Warhammer 40,000: Darktide is the new co-op focused experience from the award-winning team behind the Vermintide series. As Tertium falls, Rejects Will Rise.',
    store_url: 'https://store.steampowered.com/app/1361210/',
  },
  {
    title: 'Valheim',
    year: 2021,
    steam_app_id: 892970,
    steam_header:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/892970/1888731b59362fca6c026cdbafa3dfffd45c3146/header_alt_assets_6.jpg?t=1791544831',
    screenshots: [
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/892970/5a31353178f635b67f0c8720ebb8a1a95b637276/ss_5a31353178f635b67f0c8720ebb8a1a95b637276.600x338.jpg?t=1791544831',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/892970/bc7c361dab1780543a3ceca50c8fba831e5bc8db/ss_bc7c361dab1780543a3ceca50c8fba831e5bc8db.600x338.jpg?t=1791544831',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/892970/ss_a600a7d4ca954543e22f571a9629521a13f82143.600x338.jpg?t=1791544831',
    ],
    developers: ['Iron Gate AB'],
    genres: ['Action', 'Adventure', 'Indie', 'RPG'],
    release_date: '2026-09-09',
    platforms: ['Windows', 'macOS', 'Linux'],
    multiplayer: true,
    positive_reviews: 94,
    review_count: 560_677,
    review_summary: 'Very Positive',
    metacritic: 89,
    price_usd: 29.99,
    description:
      'A collaborative exploration and survival game for 1-10 players, set in a procedurally generated afterlife inspired by Viking culture. Battle, build, and conquer your way to a saga worthy of Odin’s patronage!',
    store_url: 'https://store.steampowered.com/app/892970/',
  },
  {
    title: 'Factorio',
    year: 2020,
    steam_app_id: 427520,
    steam_header:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/427520/ab9a2df0a77caebde20dc45adc021de8cdcf7cc5/header.jpg?t=1787348817',
    screenshots: [
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/427520/ss_36e4d8e5540805f5ed492d24d784ed9ba661752b.600x338.jpg?t=1787348817',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/427520/ss_171f398a8e347fad650a9c1b6c3b77c612781510.600x338.jpg?t=1787348817',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/427520/ss_0bf814493f247b6baa093511b46c352cf9e98435.600x338.jpg?t=1787348817',
    ],
    developers: ['Wube Software LTD.'],
    genres: ['Casual', 'Indie', 'Simulation', 'Strategy'],
    release_date: '2020-08-14',
    platforms: ['Windows', 'macOS', 'Linux'],
    multiplayer: true,
    positive_reviews: 98,
    review_count: 235_903,
    review_summary: 'Overwhelmingly Positive',
    metacritic: 90,
    price_usd: 35,
    description:
      "Factorio is a game about building and creating automated factories to produce items of increasing complexity, within an infinite 2D world. Use your imagination to design your factory, combine simple elements into ingenious structures, and finally protect it from the creatures who don't really like you.",
    store_url: 'https://store.steampowered.com/app/427520/',
  },
  {
    title: 'Subnautica',
    year: 2018,
    steam_app_id: 264710,
    steam_header:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/264710/header.jpg?t=1777456112',
    screenshots: [
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/264710/ss_e182b6b20bb797500f9f63c561586d920d44e37c.600x338.jpg?t=1777456112',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/264710/ss_970a13f246e33e0df26d93baf9f8e975732adb4b.600x338.jpg?t=1777456112',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/264710/ss_5f2f2ea498cdc632cbffd6cf37c1a09670eb3272.600x338.jpg?t=1777456112',
    ],
    developers: ['Unknown Worlds Entertainment'],
    genres: ['Adventure', 'Indie'],
    release_date: '2018-01-23',
    platforms: ['Windows', 'macOS'],
    multiplayer: false,
    positive_reviews: 97,
    review_count: 381_897,
    review_summary: 'Overwhelmingly Positive',
    metacritic: 87,
    price_usd: 29.99,
    description:
      'Descend into the depths of an alien underwater world filled with wonder and peril. Craft equipment, pilot submarines and out-smart wildlife to explore lush coral reefs, volcanoes, cave systems, and more - all while trying to survive.',
    store_url: 'https://store.steampowered.com/app/264710/',
  },
  {
    title: 'PUBG: BATTLEGROUNDS',
    year: 2017,
    steam_app_id: 578080,
    steam_header:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/578080/841ea38bc58cabb70aef65365cf50bc2d79329d9/header.jpg?t=1786493086',
    screenshots: [
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/578080/c16e2f2d122cae77a1cbaca19263df0f2d2214fa/ss_c16e2f2d122cae77a1cbaca19263df0f2d2214fa.600x338.jpg?t=1786493086',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/578080/aa1c51a9b45c88e770b443d8d3cd28f3024b0760/ss_aa1c51a9b45c88e770b443d8d3cd28f3024b0760.600x338.jpg?t=1786493086',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/578080/bf9b3de5896d4ec7ef9531938b26946cded81fdf/ss_bf9b3de5896d4ec7ef9531938b26946cded81fdf.600x338.jpg?t=1786493086',
    ],
    developers: ['PUBG Corporation'],
    genres: ['Action', 'Adventure', 'Massively Multiplayer', 'Free To Play'],
    release_date: '2017-12-21',
    platforms: ['Windows'],
    multiplayer: true,
    positive_reviews: 61,
    review_count: 2_748_338,
    review_summary: 'Mixed',
    price_usd: 0,
    description:
      'PUBG: BATTLEGROUNDS, the high-stakes winner-take-all shooter that started the Battle Royale craze, is free-to-play! Drop into diverse maps, loot unique weapons and supplies, and survive in an ever-shrinking zone where every turn could be your last.',
    store_url: 'https://store.steampowered.com/app/578080/',
  },
  {
    title: 'Quern - Undying Thoughts',
    year: 2016,
    steam_app_id: 512790,
    steam_header:
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/512790/header.jpg?t=1790011335',
    screenshots: [
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/512790/ss_6037890506925794e580ad15cbe0a13d9fd8ac6e.600x338.jpg?t=1790011335',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/512790/ss_6b831fc33fc070997c7390f33aa81505e6b30cd2.600x338.jpg?t=1790011335',
      'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/512790/ss_0115dfcd07555ac8265e74782981708dab27cd54.600x338.jpg?t=1790011335',
    ],
    developers: ['Zadbox Entertainment'],
    genres: ['Adventure'],
    release_date: '2016-11-28',
    platforms: ['Windows', 'macOS', 'Linux'],
    multiplayer: false,
    positive_reviews: 91,
    review_count: 4_119,
    review_summary: 'Very Positive',
    metacritic: 83,
    price_usd: 24.99,
    description:
      'Discover the truth about Quern’s past, unfold the mysteries of its present, and be the explorer who shapes its future. Quern introduces reusable puzzle mechanics to the classic genre, making the player think about the game as a whole, and not just as a series of individual challenges.',
    store_url: 'https://store.steampowered.com/app/512790/',
  },
];

/**
 * The games arrive as YAML, set up with Steam's banner leading a gallery of
 * screenshots, and the reviews as a bar, a compact count, Steam's verdict as
 * a coloured pill and Metacritic stars, beside the price, a multiplayer
 * badge, the store blurb and a link. The year, app id and platforms are a
 * tick away.
 */
export const GAME_SAMPLE: Sample = {
  id: 'games',
  label: 'Games',
  detail: '10 games, as YAML',
  format: 'yaml',
  text: stringifyYaml({ games: SAMPLE_GAMES }, { lineWidth: 0 }),
  path: ['games'],
  roles: {
    labelField: 'title',
    summaryFields: [
      'steam_header',
      'screenshots',
      'developers',
      'genres',
      'release_date',
      'positive_reviews',
      'review_count',
      'review_summary',
      'metacritic',
      'price_usd',
      'multiplayer',
      'description',
      'store_url',
    ],
    fieldRenderers: {
      steam_header: 'steam-header',
      screenshots: 'image-gallery',
      developers: 'tags',
      genres: 'tags',
      release_date: 'date',
      positive_reviews: 'bar-100',
      review_count: 'compact',
      review_summary: 'pills',
      metacritic: 'stars-100',
      price_usd: 'currency-USD',
      multiplayer: 'badge',
      description: 'long-text',
      store_url: 'link',
    },
  },
};

/** Every sample, in the order they are offered. */
export const SAMPLES: Sample[] = [SONG_SAMPLE, MOVIE_SAMPLE, GAME_SAMPLE];
