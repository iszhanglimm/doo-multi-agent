import React, { createContext, useContext, useState, useCallback } from 'react';

interface User {
  id: string;
  name: string;
  role: 'teacher' | 'admin';
  avatar?: string;
  classId?: string;
}

interface StoredUser {
  password: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (username: string, password: string, name: string, classId?: string) => Promise<{ success: boolean; message: string }>;
  updateProfile: (updates: Partial<Pick<User, 'name' | 'avatar'>>) => Promise<boolean>;
  updatePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  // 管理员功能
  getAllUsers: () => Array<{ username: string; user: User }>;
  adminUpdateUser: (username: string, updates: { user?: Partial<User> }) => Promise<boolean>;
  adminDeleteUser: (username: string) => Promise<boolean>;
  adminResetPassword: (username: string, newPassword: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'doo_users';
const USER_SESSION_KEY = 'doo_user';
const USERNAME_KEY = 'doo_username';

// 默认教师账号 - 4个班级对应4位老师
const DEFAULT_USERS: Record<string, StoredUser> = {
  'teacher1': {
    password: '123456',
    user: { id: 't001', name: '王老师', role: 'teacher', avatar: '👩‍🏫', classId: 'class_001' },
  },
  'teacher2': {
    password: '123456',
    user: { id: 't002', name: '李老师', role: 'teacher', avatar: '👨‍🏫', classId: 'class_002' },
  },
  'teacher3': {
    password: '123456',
    user: { id: 't003', name: '张老师', role: 'teacher', avatar: '👩‍🏫', classId: 'class_003' },
  },
  'teacher4': {
    password: '123456',
    user: { id: 't004', name: '刘老师', role: 'teacher', avatar: '👨‍🏫', classId: 'class_004' },
  },
  'admin': {
    password: 'admin',
    user: { id: 'admin', name: '管理员', role: 'admin', avatar: '🔧' },
  },
};

function loadUsers(): Record<string, StoredUser> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  // 首次加载，保存默认用户
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
  return { ...DEFAULT_USERS };
}

function saveUsers(users: Record<string, StoredUser>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<Record<string, StoredUser>>(loadUsers);
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem(USER_SESSION_KEY);
    const savedUsername = localStorage.getItem(USERNAME_KEY);
    if (savedUser && savedUsername) {
      try {
        const parsed = JSON.parse(savedUser) as User;
        // 验证用户是否仍然存在于用户列表中
        const currentUsers = loadUsers();
        if (currentUsers[savedUsername]) {
          return parsed;
        }
      } catch {
        localStorage.removeItem(USER_SESSION_KEY);
        localStorage.removeItem(USERNAME_KEY);
      }
    }
    return null;
  });

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    const record = users[username];
    if (record && record.password === password) {
      setUser(record.user);
      localStorage.setItem(USER_SESSION_KEY, JSON.stringify(record.user));
      localStorage.setItem(USERNAME_KEY, username);
      return true;
    }
    return false;
  }, [users]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(USER_SESSION_KEY);
    localStorage.removeItem(USERNAME_KEY);
  }, []);

  const register = useCallback(async (
    username: string,
    password: string,
    name: string,
    classId?: string
  ): Promise<{ success: boolean; message: string }> => {
    if (!username || !password || !name) {
      return { success: false, message: '请填写完整信息' };
    }
    if (username.length < 3) {
      return { success: false, message: '用户名至少3个字符' };
    }
    if (password.length < 6) {
      return { success: false, message: '密码至少6个字符' };
    }
    if (users[username]) {
      return { success: false, message: '用户名已存在' };
    }

    const newUser: StoredUser = {
      password,
      user: {
        id: `t_${Date.now()}`,
        name,
        role: 'teacher',
        avatar: '👩‍🏫',
        classId: classId || 'class_001',
      },
    };

    const updatedUsers = { ...users, [username]: newUser };
    setUsers(updatedUsers);
    saveUsers(updatedUsers);

    return { success: true, message: '注册成功' };
  }, [users]);

  const updateProfile = useCallback(async (updates: Partial<Pick<User, 'name' | 'avatar'>>): Promise<boolean> => {
    const username = localStorage.getItem(USERNAME_KEY);
    if (!username || !user) return false;

    const record = users[username];
    if (!record) return false;

    const updatedUser = { ...record.user, ...updates };
    const updatedRecord = { ...record, user: updatedUser };
    const updatedUsers = { ...users, [username]: updatedRecord };

    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    setUser(updatedUser);
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(updatedUser));

    return true;
  }, [users, user]);

  const updatePassword = useCallback(async (
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const username = localStorage.getItem(USERNAME_KEY);
    if (!username) {
      return { success: false, message: '未登录' };
    }

    const record = users[username];
    if (!record) {
      return { success: false, message: '用户不存在' };
    }

    if (record.password !== oldPassword) {
      return { success: false, message: '原密码错误' };
    }

    if (newPassword.length < 6) {
      return { success: false, message: '新密码至少6个字符' };
    }

    const updatedRecord = { ...record, password: newPassword };
    const updatedUsers = { ...users, [username]: updatedRecord };

    setUsers(updatedUsers);
    saveUsers(updatedUsers);

    return { success: true, message: '密码修改成功' };
  }, [users]);

  // 管理员功能
  const getAllUsers = useCallback((): Array<{ username: string; user: User }> => {
    return Object.entries(users)
      .filter(([username]) => username !== 'admin')
      .map(([username, record]) => ({ username, user: record.user }));
  }, [users]);

  const adminUpdateUser = useCallback(async (username: string, updates: { user?: Partial<User> }): Promise<boolean> => {
    if (!users[username]) return false;

    const updatedRecord = { ...users[username] };
    if (updates.user) updatedRecord.user = { ...updatedRecord.user, ...updates.user };

    const updatedUsers = { ...users, [username]: updatedRecord };
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    return true;
  }, [users]);

  const adminDeleteUser = useCallback(async (username: string): Promise<boolean> => {
    if (!users[username] || username === 'admin') return false;

    const updatedUsers = { ...users };
    delete updatedUsers[username];
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    return true;
  }, [users]);

  const adminResetPassword = useCallback(async (username: string, newPassword: string): Promise<boolean> => {
    if (!users[username]) return false;
    if (newPassword.length < 6) return false;

    const updatedRecord = { ...users[username], password: newPassword };
    const updatedUsers = { ...users, [username]: updatedRecord };
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
    return true;
  }, [users]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      login,
      logout,
      register,
      updateProfile,
      updatePassword,
      getAllUsers,
      adminUpdateUser,
      adminDeleteUser,
      adminResetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
