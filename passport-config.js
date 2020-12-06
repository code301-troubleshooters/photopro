const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const pg = require('pg');
const client = new pg.Client(process.env.DATABASE_URL);

function initialize(passport, getUserInfoByEmail, getUserById) {
    const authenticateUser = async (email, password, done) => {
        const user = await getUserInfoByEmail(email);
        if (user === null) {
            return done(null, false, { message: "User doesn't exist" });
        }
        return await bcrypt.compare(password, user.password)
            .then(result => {
                if (result === true) {
                    return done(null, user);
                } else {
                    return done(null, false, { message: 'Password is incorrect' });
                }
            })
            .catch(e => done(e));
    };
    passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser));
    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser(async (id, done) => {
        return done(null, await getUserById(id));
    });
}

module.exports = initialize