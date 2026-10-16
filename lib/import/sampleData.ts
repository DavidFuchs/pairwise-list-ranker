import { stringify as stringifyYaml } from 'yaml';

import type { FieldRoles } from '@/types/source';

/** Ready-made data for trying the ranker without typing or importing anything. */
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

/**
 * The one source of truth: song names alone make the plain-list sample; the
 * whole records, under `songs`, make the YAML and JSON ones. Every field suits
 * at least one renderer, so the sample can show them off.
 */
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
    apple_music_url: 'https://music.apple.com/ca/album/always-on-my-mind-feat-till-lindemann/1586116957?i=1586116964',
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

/** Plain-list sample: just the song names, one per line. */
export const SAMPLE_LIST = SAMPLE_SONGS.map((song) => song.song_name).join('\n');

/** Where the songs sit in the YAML and JSON samples. */
export const SAMPLE_PATH = ['songs'];

const SAMPLE_DOCUMENT = { songs: SAMPLE_SONGS };

export const SAMPLE_YAML = stringifyYaml(SAMPLE_DOCUMENT, { lineWidth: 0 });
export const SAMPLE_JSON = `${JSON.stringify(SAMPLE_DOCUMENT, null, 2)}\n`;

/**
 * The setup the YAML and JSON samples arrive with, chosen to show the cards
 * off: album art beside the title, a play button that tries Apple Music and
 * then Deezer, and details drawn as tags, a coloured genre, a year, a
 * duration and a badge. Fields left out - the long Apple Music
 * link, the ISRC - are a tick away in the setup list.
 */
export const SAMPLE_ROLES: FieldRoles = {
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
};
