import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(undefined);

const API_URL = 'http://localhost:5000/api';

export function AuthProvider({ children }) {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [role, setRole] = useState(null);
	const [user, setUser] = useState(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		try {
			const token = localStorage.getItem("token");
			if (token) {
				// Validate token and fetch user data
				validateToken(token);
			} else {
				setIsLoading(false);
			}
		} catch (error) {
			console.error("Auth initialization error:", error);
			setIsLoading(false);
		}
	}, []);

	const validateToken = async (token) => {
		try {
			const response = await fetch(`${API_URL}/auth/profile`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});
			if (response.ok) {
				const userData = await response.json();
				setUser(userData);
				setRole(userData.role);
				setIsAuthenticated(true);
			} else {
				// Token is invalid
				logout();
			}
		} catch (error) {
			console.error("Token validation error:", error);
			logout();
		} finally {
			setIsLoading(false);
		}
	};

	const login = async (email, password, userRole, additionalData = {}) => {
		try {
			const response = await fetch(`${API_URL}/auth/login`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					email,
					password,
					role: userRole,
					...additionalData
				}),
			});

			const data = await response.json();

			if (response.ok && data.token) {
				setUser(data);
				setRole(data.role);
				setIsAuthenticated(true);
				localStorage.setItem("token", data.token);
				return true;
			} else {
				throw new Error(data.message || 'Login failed');
			}
		} catch (error) {
			console.error("Login error:", error);
			throw error;
		}
	};

	const register = async (userData) => {
		try {
			const response = await fetch(`${API_URL}/auth/register`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(userData),
			});

			const data = await response.json();

			if (response.ok && data.token) {
				setUser(data);
				setRole(data.role);
				setIsAuthenticated(true);
				localStorage.setItem("token", data.token);
				return true;
			} else {
				throw new Error(data.message || 'Registration failed');
			}
		} catch (error) {
			console.error("Registration error:", error);
			throw error;
		}
	};

	const logout = () => {
		setUser(null);
		setRole(null);
		setIsAuthenticated(false);
		localStorage.removeItem("token");
	};

	return (
		<AuthContext.Provider 
			value={{ 
				isAuthenticated, 
				role, 
				user,
				login, 
				logout, 
				register,
				isLoading 
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

export function getDefaultPath(role) {
	switch(role) {
		case 'student':
			return '/student/dashboard';
		case 'faculty':
			return '/faculty/dashboard';
		case 'admin':
			return '/admin/dashboard';
		default:
			return '/login';
	}
}
