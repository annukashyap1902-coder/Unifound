import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCeqJ1_6HrenR27QiIC2ha8W29jQngZBS4",
  authDomain: "unifound-513cf.firebaseapp.com",
  projectId: "unifound-513cf",
  storageBucket: "unifound-513cf.firebasestorage.app",
  messagingSenderId: "159159966415",
  appId: "1:159159966415:web:02040374abca4c98f1f5ba"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let generatedOTP;

// --- AUTH LISTENER ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        const avatar = document.getElementById('user-avatar');
        if(avatar) avatar.innerText = (user.displayName || user.email)[0].toUpperCase();
        showDashboard();
    } else {
        document.getElementById('login-page').style.display = 'flex';
        document.getElementById('dashboard-page').style.display = 'none';
    }
});

const showDashboard = () => {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('dashboard-page').style.display = 'flex';
    loadItems(); 
};

window.logout = () => {
    if (confirm("Are you sure?")) {
        signOut(auth).catch((error) => alert(error.message));
    }
};

// --- OTP LOGIC ---
window.sendOTP = async () => {
    const email = document.getElementById('user-email').value.trim();
    if(!email) return alert("Enter Your Enail Address!");
    try {
        generatedOTP = Math.floor(100000 + Math.random() * 900000);
        emailjs.send("service_q76f9p7", "template_gjbpbjc", {
            to_email: email,
            otp_code: generatedOTP,
            time: new Date().toLocaleTimeString() 
        }, "IBEU3s9Zei5rD5m7Z")
        .then(() => {
            alert("OTP sent!");
            document.getElementById('email-section').style.display = 'none';
            document.getElementById('otp-section').style.display = 'block';
        });
    } catch (e) { alert("Error sending OTP!"); }
};
// --- OTP VERIFY & LOGIN ---
window.verifyOTP = async () => {
    const userOTP = document.getElementById('otp-input').value;
    const email = document.getElementById('user-email').value.trim();
    const name = document.getElementById('user-name').value.trim();
    const nameGroup = document.getElementById('name-group');

    if (userOTP == generatedOTP) {
        try {
            // 1. Firebase mein is email ka data check karein
            const userRef = doc(db, "users", email);
            const userSnap = await getDoc(userRef);
            const isSignUpMode = (nameGroup.style.display === "block");

            // 2. Agar Naya User hai (Sign Up), toh database mein entry karo
            if (isSignUpMode && !userSnap.exists()) {
                await setDoc(userRef, {
                    name: name,
                    email: email,
                    createdAt: serverTimestamp()
                });
            }

            // --- SABSE ZAROORI PART ---
            // Yahan hum dummy authentication state simulate karte hain 
            // Kyunki aap custom OTP use kar rahi hain, humein user info save karni hogi
            localStorage.setItem('loggedInUser', JSON.stringify({
                email: email,
                name: userSnap.exists() ? userSnap.data().name : name,
                uid: email.replace(/[^a-zA-Z0-9]/g, "") // Unique ID banayi email se
            }));

            alert("Login Successful!");
            showDashboard(); // Dashboard par bhejo
        } catch (e) {
            alert("Login Error: " + e.message);
        }
    } else {
        alert("Enter Correct OTP !");
    }
};

window.loginWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).then(async (result) => {
        const userRef = doc(db, "users", result.user.email);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, { fullName: result.user.displayName, email: result.user.email, date: new Date() });
        }
        showDashboard();
    });
};

// --- SAVE ITEM FUNCTION (Fixed spelling & duplication) ---
window.saveItem = async () => {
    try {
        const type = document.getElementById('post-type').value;
        const name = document.getElementById('post-item-name').value.trim();
        const desc = document.getElementById('post-desc').value.trim();
        const contact = document.getElementById('post-contact').value.trim(); 
        const fileInput = document.getElementById('post-image');
        const file = fileInput.files[0];

        // --- ADDED: OTP user check taaki alert na aaye ---
        const localUser = JSON.parse(localStorage.getItem('loggedInUser'));
        const currentUser = auth.currentUser || localUser;

        if (!currentUser) return alert("Please login first!");
        if (!name || !file) return alert("Please Enter Full Details !");
if (contact.length !== 10) {
    alert("Enter Correct Contact Number !");
    return;
}
        const reader = new FileReader();
        reader.onload = async (e) => {
            // --- ADDED: Image Compression taaki 1MB wala error na aaye ---
            const img = new Image();
            img.src = e.target.result;
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Image size chota karna (Max 600px width)
                const scaleFactor = 600 / img.width;
                canvas.width = 600;
                canvas.height = img.height * scaleFactor;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Quality kam karke Base64 banana
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);

                try {
                    await addDoc(collection(db, "items"), {
                        type: type,
                        itemName: name,
                        description: desc,
                        contactNumber: contact, 
                        image: compressedBase64, // Ab ye 1MB se choti hogi
                        // --- ADDED: OTP user ke liye ID handle karna ---
                        userId: currentUser.uid || currentUser.email.replace(/[^a-zA-Z0-9]/g, ""),
                        userEmail: currentUser.email,
                        timestamp: serverTimestamp()
                    });

                    alert("Post Successful!");
                    document.getElementById('itemModal').style.display = 'none';
                    
                    // Form reset
                    document.getElementById('post-item-name').value = "";
                    document.getElementById('post-desc').value = "";
                    document.getElementById('post-contact').value = "";
                    fileInput.value = "";
                } catch (error) { 
                    // Ye wahi error handle karega jo image badi hone par aata hai
                    alert("Database Error: " + error.message); 
                }
            };
        };
        reader.readAsDataURL(file);
    } catch (err) { alert("System Error!"); }
};

// --- LOAD ITEMS ---
function loadItems() {
    const listDiv = document.getElementById('items-list');
    const q = query(collection(db, "items"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        listDiv.innerHTML = "";
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            listDiv.innerHTML += `
                <div class="item-card">
                    <img src="${data.image}" class="card-img" style="width:100%; height:180px; object-fit:cover;">
                    <div class="card-body">
                        <span class="badge ${data.type === 'lost' ? 'badge-lost' : 'badge-found'}">${data.type}</span>
                        <h4>${data.itemName}</h4>
                        <p>${data.description}</p>
                        <div style="background:#eef2ff; padding:10px; border-radius:10px; margin:10px 0; border: 2px solid #3b82f6;">
                           <p style="margin:0; font-weight: bold; color: #1e40af;">
                              📞 Contact: ${data.contactNumber || "Not provided"}
                           </p>
                        </div>
                        <small>Reported by: ${data.userEmail}</small>
                    </div>
                </div>`;
        });
    });
}

// --- PROFILE & DELETE ---
// --- PROFILE LOGIC (Fixed & Tested) ---
window.openProfile = () => {
    const modal = document.getElementById('profileModal');
    const listDiv = document.getElementById('user-posts-list');

    // --- ADDED: Local Storage check for OTP users ---
    const localUser = JSON.parse(localStorage.getItem('loggedInUser'));
    const currentUser = auth.currentUser || localUser; 

    if (!currentUser) {
        alert("Please Login First!");
        return;
    }

    // Modal ko dikhane ya chhupane ka logic
    if (modal.style.display === 'none' || modal.style.display === '') {
        modal.style.display = 'block';
        
        // User ka naam set karna
        const nameDisplay = document.getElementById('display-user-name');
        // --- ADDED: Support for OTP name field ---
        if(nameDisplay) nameDisplay.innerText = currentUser.displayName || currentUser.name || currentUser.email;

        // Database se sirf is user ki posts lana
        const q = query(collection(db, "items"), orderBy("timestamp", "desc"));
        onSnapshot(q, (snapshot) => {
            listDiv.innerHTML = "";
            let count = 0;

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                
                // --- ADDED: Support for both UID and Email filtering ---
                const currentId = currentUser.uid || (currentUser.email ? currentUser.email.replace(/[^a-zA-Z0-9]/g, "") : null);
                
                // Filter: Sirf apni posts dikhao
                if (data.userId === currentId || data.userEmail === currentUser.email) {
                    count++;
                    listDiv.innerHTML += `
                    <div style="display:flex; align-items:center; justify-content:space-between; background:#fff; padding:12px; border-radius:12px; border:1px solid #eee; margin-bottom:10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <div style="text-align:left;">
                            <p style="margin:0; font-weight:bold; font-size:14px; color:#333;">${data.itemName}</p>
                            <p style="margin:0; font-size:11px; color:#6366f1; font-weight:600;">📞 ${data.contactNumber || 'No Number'}</p>
                            <p style="margin:0; font-size:10px; color:#888; text-transform:uppercase;">${data.type}</p>
                        </div>
                        <button onclick="deletePost('${docSnap.id}')" style="background:#fee2e2; color:#ef4444; border:none; padding:8px 12px; border-radius:8px; cursor:pointer; font-size:11px; font-weight:bold; transition: 0.3s;">
                            Delete
                        </button>
                    </div>`;
                }
            });

            // Post count update karna
            const countDisplay = document.getElementById('user-post-count');
            if(countDisplay) countDisplay.innerText = `${count} items reported`;
            
            if(count === 0) {
                listDiv.innerHTML = `<p style="color:#999; font-size:13px; margin-top:20px;">You haven't posted Anything yet</p>`;
            }
        });
    } else {
        modal.style.display = 'none';
    }
};

// Modal band karne ke liye (agar button ho)
window.closeProfile = () => {
    document.getElementById('profileModal').style.display = 'none';
};

window.deletePost = async (id) => {
    if(confirm("Delete this post?")) {
        try {
            await deleteDoc(doc(db, "items", id));
            alert("Deleted!");
        } catch (e) { alert("Failed: " + e.message); }
    }
};

// --- TOGGLE MODE (UI Fix for "Back to login") ---
window.toggleMode = () => {
    const nameGroup = document.getElementById('name-group');
    const title = document.getElementById('form-title');
    const btn = document.getElementById('main-btn');
    const toggleContainer = document.getElementById('toggle-container');

    const isLogin = nameGroup.style.display === "none";

    if (isLogin) {
        // SIGN UP MODE
        nameGroup.style.display = "block";
        title.innerText = "Create an account";
        btn.innerText = "Sign Up with OTP";
        toggleContainer.innerHTML = `Already have an account? <a href="#" onclick="toggleMode()" style="color:var(--primary); text-decoration:none; font-weight:700;">Back to login</a>`;
    } else {
        // LOGIN MODE
        nameGroup.style.display = "none";
        title.innerText = "Helping students find their belongings";
        btn.innerText = "Send OTP Code";
        toggleContainer.innerHTML = `New here? <a href="#" onclick="toggleMode()" style="color:var(--primary); text-decoration:none; font-weight:700;">Create account</a>`;
    }
};

// --- SEND OTP (Security Fix: Checking if user exists) ---
window.sendOTP = async () => {
    const email = document.getElementById('user-email').value.trim();
    const nameGroup = document.getElementById('name-group');
    
    if(!email) return alert("Please Enter your Email Address !");

    try {
        // Database mein check karo ki user pehle se hai ya nahi
        const userRef = doc(db, "users", email);
        const userSnap = await getDoc(userRef);
        const isSignUpMode = (nameGroup.style.display === "block");

        // SECURITY CHECK:
        if (!isSignUpMode && !userSnap.exists()) {
            return alert("Cann't find account,Please Signup First !");
        }
        
        if (isSignUpMode && userSnap.exists()) {
            return alert("This Email is already registered,please Login First");
        }

        // Agar sab sahi hai toh OTP bhejo
        generatedOTP = Math.floor(100000 + Math.random() * 900000);
        
        emailjs.send("service_q76f9p7", "template_gjbpbjc", {
            to_email: email,
            otp_code: generatedOTP,
            time: new Date().toLocaleTimeString() 
        }, "IBEU3s9Zei5rD5m7Z")
        .then(() => {
            alert("OTP sent to " + email);
            document.getElementById('email-section').style.display = 'none';
            document.getElementById('otp-section').style.display = 'block';
        });
    } catch (e) { 
        console.error(e);
        alert("System Error: Firebase connectivity check karein."); 
    }
};
window.searchItems = () => {
    const queryStr = document.getElementById('search-bar').value.toLowerCase();
    const cards = document.querySelectorAll('.item-card');
    cards.forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(queryStr) ? "block" : "none";
    });
};