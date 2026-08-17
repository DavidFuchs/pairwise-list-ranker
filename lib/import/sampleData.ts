import { stringify as stringifyYaml } from 'yaml';

/** Ready-made data for trying the ranker without typing or importing anything. */
export const SAMPLE_LIST_NAME = '30 sci-fi movies';

export interface SampleMovie {
  title: string;
  year: number;
  genre: string;
}

/** The one source of truth: titles alone make the plain-list sample, titles
 * plus year and genre make the YAML/JSON samples. */
export const SAMPLE_MOVIES: SampleMovie[] = [
  { title: '2001: A Space Odyssey', year: 1968, genre: 'Sci-Fi' },
  { title: 'Blade Runner', year: 1982, genre: 'Neo-Noir' },
  { title: 'Alien', year: 1979, genre: 'Sci-Fi Horror' },
  { title: 'The Matrix', year: 1999, genre: 'Action' },
  { title: 'Arrival', year: 2016, genre: 'Drama' },
  { title: 'Solaris', year: 1972, genre: 'Drama' },
  { title: 'Star Wars: A New Hope', year: 1977, genre: 'Space Opera' },
  { title: 'The Terminator', year: 1984, genre: 'Action' },
  { title: 'E.T. the Extra-Terrestrial', year: 1982, genre: 'Family' },
  { title: 'Close Encounters of the Third Kind', year: 1977, genre: 'Drama' },
  { title: 'Jurassic Park', year: 1993, genre: 'Adventure' },
  { title: 'Back to the Future', year: 1985, genre: 'Comedy' },
  { title: 'Aliens', year: 1986, genre: 'Action' },
  { title: 'The Thing', year: 1982, genre: 'Horror' },
  { title: 'Metropolis', year: 1927, genre: 'Drama' },
  { title: 'A Clockwork Orange', year: 1971, genre: 'Crime' },
  { title: 'Children of Men', year: 2006, genre: 'Thriller' },
  { title: 'District 9', year: 2009, genre: 'Action' },
  { title: 'Ex Machina', year: 2014, genre: 'Thriller' },
  { title: 'Interstellar', year: 2014, genre: 'Drama' },
  { title: 'Gattaca', year: 1997, genre: 'Drama' },
  { title: 'Minority Report', year: 2002, genre: 'Action' },
  { title: 'Total Recall', year: 1990, genre: 'Action' },
  { title: 'The Fifth Element', year: 1997, genre: 'Adventure' },
  { title: 'Edge of Tomorrow', year: 2014, genre: 'Action' },
  { title: 'Inception', year: 2010, genre: 'Thriller' },
  { title: 'Dune', year: 2021, genre: 'Adventure' },
  { title: 'Predator', year: 1987, genre: 'Action' },
  { title: 'Brazil', year: 1985, genre: 'Comedy' },
  { title: 'Moon', year: 2009, genre: 'Drama' },
];

/** Plain-list sample: just the titles, one per line. */
export const SAMPLE_LIST = SAMPLE_MOVIES.map((movie) => movie.title).join('\n');

/** Complex samples: title plus year and genre, so the picker has real choices to make. */
export const SAMPLE_YAML = stringifyYaml(SAMPLE_MOVIES, { lineWidth: 0 });
export const SAMPLE_JSON = `${JSON.stringify(SAMPLE_MOVIES, null, 2)}\n`;
