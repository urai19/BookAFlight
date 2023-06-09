const bcrypt = require("bcrypt");
const { customer } = require("../models");
const { sign } = require("jsonwebtoken");
const sgMail = require('@sendgrid/mail');
const path = require("path");
sgMail.setApiKey("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")
const client = require('twilio')('ACe442c2772b48760a1f1ae5d9f37a6cc8', '85e1a23f7430ab54c9cbb47c2c9c6a00');

const checkAge = (birth) => {
    let today = new Date();
    birth = new Date(birth);
    let age = today.getFullYear() - birth.getFullYear();
    let monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}


// signup page
exports.signupPage = async (req, res) => {
    res.sendFile(path.join(__dirname, "/../views/signup.html"));
}

// login page
exports.loginPage = async (req, res) => {
    res.sendFile(path.join(__dirname, "/../views/login.html"));
}

// signup
exports.signup = async (req, res) => {
    const profile = req.body;
    const user = await customer.findOne({ where: { email: profile.email }});
    console.log(profile);
    if (
        !/^[^@]+@[^@]+\.[^@]+$/.test(profile.email) ||
        user ||
        !/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/.test(profile.password) ||
        profile.firstName === "" ||
        profile.lastName === "" ||
        checkAge(profile.dob) < 21) {
            return res.status(400).json("Invalid signup!");
    }
    
    // create account, hashing password
    bcrypt.hash(profile.password, 10).then(async (hash) => {
        await customer.create({
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            password: hash, // hash password
            dob: profile.dob,
            phone: profile.phone,
            preferences: profile.preferences,
        });
        
        return res.sendFile(path.join(__dirname, "../views/signupsuccess.html"));
    });

    const phoneNumber = profile.phone; 
    const message = "Welcome " + profile.firstName + " "+ profile.lastName+ " to Book A Flight! Your account has successfully been created";
                    client.messages.create({
                        to: phoneNumber,
                        from: '+18442948043',
                        body: message}).then((message) => {
                            console.log('Message sent:', message.sid);
                        }).catch((err)=>{
                            console.error('Error sending message:', err);
                        });

    //Confirmation email using twilio sendgrid
    const msg = {
        to: profile.email, // Change to your recipient
        from: 'udayan19.rai@gmail.com', // Change to your verified sender
        subject: 'BookAFlight account creation successful',
        text: 'You account was successfully created!',
        html: '<strong>Enjoy your bokking experience!</strong>',
    }
    sgMail
        .send(msg)
        .then(() => {
            console.log('Email sent')
        })
        .catch((error) => {
          console.error(error)
        })
};

// login
exports.login = async (req, res) => {
    const { email, password } = req.body;
    
    // check if user exists
    const user = await customer.findOne({ where : { email: email }});
    if (!user) return res.status(400).json({ error: "Incorrect email or password." });

    // check if email and password match
    bcrypt.compare(password, user.password).then(async (match) => {
        if (!match) return res.status(400).json({ error: "Incorrect email or password." });
        
        // generate token for login if successful
        const accessToken = sign(
            { email: user.email, id: user.id }, 
            "secretstring",
        );
        await customer.update({ rememberToken: accessToken }, { where: { id: user.id } });
        return res.status(200).json(accessToken);
        
    });
    
};

// change password - must be logged in
exports.changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await customer.findOne({ where: { id: req.user.id }});
    bcrypt.compare(oldPassword, user.password).then(async (match) => {
        if (!match) return res.json({ error: "Incorrect password!"});
        if (!/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/.test(newPassword)) return res.status(400).json("Invalid password!");
        bcrypt.hash(newPassword, 10).then(async (hash) => {
            await user.update({password: hash}, {where: { id: user.id }});
            res.status(200).json("Successfully changed password!");
        });
    });
};

// view points - must be logged in
exports.viewPoints = async (req, res) => {
    const user = await customer.findOne({ where: { id: req.user.id }});
    res.status(200).json(user.points);
};

// delete account - must be logged in
exports.deleteAccount = async (req, res) => {
    const { password } = req.body;
    const user = await customer.findOne({ where: { id: req.user.id }});
    bcrypt.compare(password, user.password).then(async match => {
        if (!match) {
            res.status(400).json({ error: "Incorrect password!"});
        } else {
            await user.destroy();
            res.status(200).json("Account successfully removed.");
        }
    });
};

// checkExists
exports.checkExists = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await customer.findOne({ where : { email : email }});
        if (!user) return res.json({ exists: false });
        return res.json({ exists: true });
    } catch (err) {
        console.log("error");
        return res.json({ exists: false });
    }
}