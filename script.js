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
    if(!email) return alert("Pehle email address bhariye!");
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

window.verifyOTP = async () => {
    const enteredOTP = document.getElementById('otp-input').value;
    const email = document.getElementById('user-email').value.trim();
    const name = document.getElementById('user-name').value.trim();
    if(enteredOTP == generatedOTP) {
        if (document.getElementById('name-group').style.display === "block") {
            await setDoc(doc(db, "users", email), { fullName: name || "User", email: email, date: new Date() });
        }
        showDashboard();
    } else { alert("Invalid OTP!"); }
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
        const currentUser = auth.currentUser;

        if (!currentUser) return alert("Please login first!");
        if (!name || !file) return alert("Item Name aur Photo zaroori hai!");

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                await addDoc(collection(db, "items"), {
                    type: type,
                    itemName: name,
                    description: desc,
                    contactNumber: contact, 
                    image: e.target.result,
                    userId: currentUser.uid,
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
            } catch (error) { alert("Database Error: " + error.message); }
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
    const currentUser = auth.currentUser;

    if (!currentUser) {
        alert("Pehle login karein!");
        return;
    }

    // Modal ko dikhane ya chhupane ka logic
    if (modal.style.display === 'none' || modal.style.display === '') {
        modal.style.display = 'block';
        
        // User ka naam set karna
        const nameDisplay = document.getElementById('display-user-name');
        if(nameDisplay) nameDisplay.innerText = currentUser.displayName || currentUser.email;

        // Database se sirf is user ki posts lana
        const q = query(collection(db, "items"), orderBy("timestamp", "desc"));
        onSnapshot(q, (snapshot) => {
            listDiv.innerHTML = "";
            let count = 0;

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                
                // Filter: Sirf apni posts dikhao
                if (data.userId === currentUser.uid) {
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
                listDiv.innerHTML = `<p style="color:#999; font-size:13px; margin-top:20px;">Aapne abhi tak koi post nahi ki hai.</p>`;
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

window.toggleMode = () => {
    const nameGroup = document.getElementById('name-group');
    const isLogin = nameGroup.style.display === "none";
    nameGroup.style.display = isLogin ? "block" : "none";
    document.getElementById('form-title').innerText = isLogin ? "Create an account" : "Helping students find belongings";
    document.getElementById('main-btn').innerText = isLogin ? "Sign Up with OTP" : "Send OTP Code";
};

window.searchItems = () => {
    const queryStr = document.getElementById('search-bar').value.toLowerCase();
    const cards = document.querySelectorAll('.item-card');
    cards.forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(queryStr) ? "block" : "none";
    });
};