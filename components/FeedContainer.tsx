import SituationHero from './SituationHero';
import TrendingBar from './TrendingBar';
import Feed from './Feed';

// Server component — TrendingBar et SituationHero sont des Client Components
export default function FeedContainer() {
  return (
    <>
      <SituationHero />
      <TrendingBar />
      <Feed />
    </>
  );
}
