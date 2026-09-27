import Link from "next/link";
import DismissibleDetails from "./dismissible-details";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { Menu, SearchIcon } from "lucide-react";
import { parseUserCountryCookie } from "@/lib/utils";
import Brand from "@/components/shared/brand";
import UserMenu from "./user-menu/user-menu";
import Cart from "./cart";
import Search from "./search/search";
import CountryLanguageCurrencySelector from "./country-lang-curr-selector";
import styles from "./header.module.css";

export default async function StoreHeader() {
    const cookieStore = await cookies();
    const userCountry = parseUserCountryCookie(
        cookieStore.get("userCountry")?.value
    );
    return (
        <header data-testid="store-header" className={styles.header}>
            <div className={styles.announcement}>
                <span>A LITTLE LUXURY. A LOT OF HAPPINESS.</span>
                <span lang="ja">日常に、心ときめく贅沢を。</span>
            </div>
            <div className={styles.bar}>
                <Link href="/" className={styles.logo}>
                    <Brand />
                </Link>
                <nav aria-label="Main navigation" className={styles.desktopNav}>
                    <Link href="/browse">The collection</Link>
                    <Link href="/#fortune">A little fortune</Link>
                    <Link href="/about">Our world</Link>
                </nav>
                <div className={styles.actions}>
                    <DismissibleDetails className={styles.search}>
                        <summary aria-label="Open search / 検索">
                            <SearchIcon size={19} />
                        </summary>
                        <div className={styles.searchPanel}>
                            <p>
                                Find your extraordinary{" "}
                                <span lang="ja">心ときめくひとつを探す</span>
                            </p>
                            <Suspense fallback={<p>Loading search…</p>}>
                                <Search />
                            </Suspense>
                        </div>
                    </DismissibleDetails>
                    <div className={styles.account}>
                        <UserMenu />
                    </div>
                    <Cart />
                    <DismissibleDetails className={styles.menu}>
                        <summary aria-label="Open menu / メニュー">
                            <Menu size={21} />
                        </summary>
                        <div className={styles.menuPanel}>
                            <nav aria-label="More navigation">
                                <Link href="/browse">
                                    The collection / コレクション
                                </Link>
                                <Link href="/#fortune">
                                    A little fortune / 幸運との出会い
                                </Link>
                                <Link href="/about">
                                    Our world / 私たちについて
                                </Link>
                                <Link href="/profile">
                                    My account / マイアカウント
                                </Link>
                                <Link href="/profile/wishlist">
                                    Wishlist / お気に入り
                                </Link>
                                <Link href="/customer-service">
                                    Customer care / お問い合わせ
                                </Link>
                            </nav>
                            <CountryLanguageCurrencySelector
                                userCountry={userCountry}
                            />
                        </div>
                    </DismissibleDetails>
                </div>
            </div>
        </header>
    );
}
