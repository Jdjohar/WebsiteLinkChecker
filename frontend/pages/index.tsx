import Head from 'next/head';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import { NextPage } from 'next';

const Home: NextPage = () => {
  return (
    <div>
      <Head>
        <title>Website Link Checker - Find Broken Links</title>
        <meta name="description" content="Monitor your websites for broken links with daily, weekly, or monthly reports." />
        <meta name="keywords" content="broken links, website monitoring, SEO" />
        <meta property="og:title" content="Website Link Checker" />
        <meta property="og:description" content="Monitor your websites for broken links." />
        <meta property="og:type" content="website" />
      </Head>
      <Navbar />
      <main className="container mx-auto p-4">
        <h1 className="text-4xl font-bold text-center mb-8">Website Link Checker</h1>
        <p className="text-lg text-center mb-8">Monitor your websites for broken links and get detailed reports.</p>
        <div className="flex justify-center gap-4">
          <Link href="/signup" className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700">
            Get Started
          </Link>
          <Link href="/plans" className="bg-gray-200 px-6 py-3 rounded hover:bg-gray-300">
            View Plans
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Home;