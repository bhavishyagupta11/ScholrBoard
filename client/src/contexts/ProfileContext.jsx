import React, { createContext, useContext, useState, useEffect } from "react";

const defaultProfile = {
	name: "Ananya Sharma",
	roll: "CS21B001",
	dept: "CSE",
	year: "3rd",
	gpa: "8.7",
	email: "ananya@jecrc.edu.in",
	phone: "+91 98765 43210",
	bio: "Passionate computer science student with interests in AI/ML and web development.",
	skills: ["C++", "Python", "React", "Node.js", "SQL", "Tailwind", "Git", "Docker"],
	certifications: [
		"Coursera ML Specialization (2024)",
		"AWS Cloud Practitioner (2025)",
		"Robotics Workshop - IITK (2024)",
	],
	projects: [
		{ name: "Smart Student Hub", tech: "MERN + Tailwind", link: "https://github.com/username/smart-hub" },
		{ name: "Code Analytics Dashboard", tech: "React + Recharts", link: "https://github.com/username/analytics" },
		{ name: "Placement Predictor", tech: "Python + Sklearn", link: "https://github.com/username/predictor" },
	],
	codingStats: {
		problemsSolved: 250,
		contestRating: 1620,
		leetcodeStreak: 12,
		githubContributions: 7,
	},
	activities: [
		{ title: "Hackathon Winner", category: "Competitions", status: "Approved", date: "2025-01-10" },
		{ title: "NSS Camp", category: "Volunteering", status: "Pending", date: "2025-01-08" },
		{ title: "Robotics Workshop", category: "Certifications", status: "Rejected", date: "2025-01-05" },
	],
};

const ProfileContext = createContext(undefined);

export function ProfileProvider({ children }) {
	const [profile, setProfile] = useState(defaultProfile);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const saved = localStorage.getItem("studentProfile");
		if (saved) {
			try {
				const parsedProfile = JSON.parse(saved);
				setProfile({ ...defaultProfile, ...parsedProfile });
			} catch (error) {
				console.error("Error parsing saved profile:", error);
			}
		}
		setIsLoading(false);
	}, []);

	const updateProfile = (updates) => {
		const newProfile = { ...profile, ...updates };
		setProfile(newProfile);
		localStorage.setItem("studentProfile", JSON.stringify(newProfile));
	};

	return (
		<ProfileContext.Provider value={{ profile, updateProfile, isLoading }}>
			{children}
		</ProfileContext.Provider>
	);
}

export function useProfile() {
	const context = useContext(ProfileContext);
	if (context === undefined) {
		throw new Error("useProfile must be used within a ProfileProvider");
	}
	return context;
}
