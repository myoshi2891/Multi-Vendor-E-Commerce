"use client";
// React, Next.js
import { useState } from "react";
import { useRouter } from "next/navigation";

// Icons
import { ChevronDown } from "lucide-react";
import "/node_modules/flag-icons/css/flag-icons.min.css";

// Types
import { Country, SelectMenuOption } from "@/lib/types";

// Country selectors
import CountrySelector from "@/components/shared/country-selector";

// countries data
import countries from "@/data/countries.json";

export default function CountryLanguageCurrencySelector({
	userCountry,
}: {
	userCountry: Country;
}) {
	// Router hook for navigation
	const router = useRouter();

	// State to manage countries dropdown visibility
	const [show, setShow] = useState(false);

	const handleCountryClick = async (country: string) => {
		// Find the country data based on the selected country name
		const countryData = countries.find((c) => c.name === country);

		if (countryData) {
			const data: Country = {
				name: countryData.name,
				code: countryData.code,
				city: "",
				region: "",
			};
			try {
				// Send a POST request to your API endpoint to set the cookie
				const response = await fetch("/api/setUserCountryInCookies", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ userCountry: data }),
				});

				if (response.ok) {
					router.refresh();
				}
			} catch (error) {
				console.error("Error in handleCountryClick:", error);
			}
		}
	};
	return (
		<div className="group relative inline-block">
			{/* Trigger */}
			<div className="">
				<div className="item-center flex h-11 cursor-pointer px-2 py-0">
					<span className="mr-0.5 grid h-[33px] place-items-center">
						<span
							className={`fi fi-${userCountry.code.toLowerCase()}`}
						/>
					</span>
					<div className="ml-1">
						<span className="mt-2 block text-xs leading-3 text-white">
							{userCountry.name}/EN/
						</span>
						<b className="text-xs font-bold text-white">
							USD
							<span className="inline-block scale-[60%] align-middle text-white">
								<ChevronDown />
							</span>
						</b>
					</div>
				</div>
			</div>
			{/* Content */}
			<div className="absolute top-0 hidden cursor-pointer group-hover:block">
				<div className="relative z-50 -ml-32 mt-12 w-[300px] rounded-[24px] bg-white px-6 pb-6 pt-2 text-main-primary">
					{/* Triangle */}
					<div className="absolute -top-1.5 right-24 size-0 !border-x-[10px] !border-b-[10px] !border-x-transparent border-b-white"></div>
					<div className="mt-4 text-[20px] font-bold leading-6">
						Ship to
					</div>
					<div className="mt-2">
						<div className="relative rounded-lg bg-white text-main-primary">
							<CountrySelector
								id={"countries"}
								open={show}
								onToggle={() => setShow(!show)}
								onChange={(val) => handleCountryClick(val)}
								selectedValue={
									(countries.find(
										(option) =>
											option.name === userCountry?.name
									) as SelectMenuOption) || countries[0]
								}
							/>
							<div className="">
								<div className="mt-4 text-[20px] font-bold leading-6">
									Language
								</div>
								<div className="relative mt-2.5 flex h-10 cursor-pointer items-center truncate rounded-lg border border-black/20 px-3 py-0">
									<div className="align-middle">English</div>
									<span className="absolute right-2">
										<ChevronDown className="scale-75 text-main-primary" />
									</span>
								</div>
							</div>
							<div className="">
								<div className="mt-4 text-[20px] font-bold leading-6">
									Currency
								</div>
								<div className="relative mt-2.5 flex h-10 cursor-pointer items-center truncate rounded-lg border border-black/20 px-3 py-0">
									<div className="align-middle">
										USD (US Dollar)
									</div>
									<span className="absolute right-2">
										<ChevronDown className="scale-75 text-main-primary" />
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
