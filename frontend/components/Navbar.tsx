import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('token'));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    router.push('/login');
  };

  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold hover:underline">
          Website Link Checker
        </Link>
        <div className="space-x-4">
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <Link href="/plans" className="hover:underline">
                Plans
              </Link>
              <button onClick={handleLogout} className="hover:underline">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">
                Login
              </Link>
              <Link href="/signup" className="hover:underline">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}