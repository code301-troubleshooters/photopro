'use strict';

const express = require('express');
const app = express();
const pg = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const flash = require('express-flash');
const passportLocal = require('passport-local');
const passport = require('passport');
const methodOverride = require('method-override');
const superagent = require('superagent');
require('dotenv').config();

const client = new pg.Client(process.env.DATABASE_URL);



const initializePassport = require('./passport-config');
initializePassport(passport, 
  (email) => {
  return client.query('SELECT * FROM users WHERE email = $1', [email])
  .then( result =>{
      if(result.rows.length !== 0){
          return  result.rows[0];
      }
      else {
          return null;
      }
  });
},
(id) =>{
  return client.query(`SELECT * FROM users WHERE id = $1`, [id])
  .then(result => {
      console.log('deserialize func');
      return result.rows[0];
  })
});

const PORT = process.env.PORT;

app.set('view engine', 'ejs');
app.use(express.static('./public'));
app.use(express.urlencoded({
  extended: true
}));
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(methodOverride('_method'));

app.get('/', homeHandler);
app.get('/register', checkNotAuthenticatied, registerUserHandler);
app.get('/login', checkNotAuthenticatied, loginUserHandler);
app.get('/dashboard', checkAuthenticatied, dashboardHandler);
app.delete('/logout', logoutHandler);
app.post('/users/signup', checkNotAuthenticatied, registerUserInDBHandler);
app.post("/users/login",checkNotAuthenticatied,  passport.authenticate("local", {
  successRedirect: "/dashboard",
  failureRedirect: "/login",
  failureFlash: true
}));

app.post('/imgSearches', (req, res)=>{
  let key = process.env.PIXABAY;
  let picSearch = req.body.search_query;

  let URL= `https://pixabay.com/api/?key=${key}&q=${picSearch}s&image_type=photo&pretty=true`;
 if(req.body.color !== 'none'){
   URL+=`&colors=${req.body.color}`
 }
 if(req.body.category !== 'none'){
  URL+=`&category=${req.body.category}`
}
if(req.body.type !== 'none'){
  URL+=`&image_type=${req.body.type}`
}
  superagent(URL)
  
  .then(imgs =>{

    let picturs =imgs.body.hits.map(img =>{
      return new Picture(img) 
    });
    res.render('searchResults', {imgs :picturs, LoggedIn: false});
   
  })
  
});


app.get('/courses', (req, res)=>{
  let URL = `https://www.udemy.com/api-2.0/courses/?category=Photography+%26+Video&page=1&page_size=12&price=price-free`;
  superagent(URL)
  .set('Authorization', `Basic ${Buffer.from(`${process.env.UDEMEM_CLIENT}:${process.env.UDEMEY_SECRET}`).toString('base64')}`)
  .then(result =>{
    let courses = result.body.results.map(val=>{
      return new Course (val);

    });
    res.status(200).render('courses', {LoggedIn:false,courses:courses});
  }).catch((e) =>{
    res.status(500).send(e);
  });
});

function homeHandler(req, res){
  if(req.user){
    res.render('index', {LoggedIn: true ,name: req.user.name})  
  }
  else{
    res.render('index', {LoggedIn: false})  
  }
}

function registerUserHandler(req, res){
  if(req.user){
    res.render('register', {LoggedIn: true ,name: req.user.name})  
  }
  else{
    res.render('register', {LoggedIn: false});  
  }
}

function loginUserHandler(req, res){
  if(req.user){
    res.render('login', {LoggedIn: true ,name: req.user.name})  
  }
  else{
    res.render('login', {LoggedIn: false});  
  }
}

function dashboardHandler(req, res){
  if(req.user){
    res.render('dashboard', {LoggedIn: true ,name: req.user.name})  
  }
  else{
    res.render('dashboard', {LoggedIn: false});  
  }
}

async function registerUserInDBHandler(req, res){
  let { name, email, password1, password2 } = req.body;
  let SQL = `INSERT INTO users(name, email, password) VALUES ($1,$2,$3) RETURNING id, password`;
  let errors = [];


  if (!name || !email || !password1 || !password2) {
    errors.push({ message: "Please enter all feilds" });
  }

  if (password1.length < 6) {
    errors.push({ message: "Password should be at least 6 charachters" });
  }

  if (password1 !== password2) {
    errors.push({ message: "Passwords don't match!" });
  }

  if (errors.length > 0) {
    console.log(errors);
    res.render('register', { LoggedIn: false, err: errors });
  } else {
    let checkIfUserExists = `SELECT * FROM users WHERE email = $1`;
    let hashedPass = await hashPasswords(password1);
    let values = [name, email, hashedPass];
    client.query(checkIfUserExists, [email])
      .then(emailChecked => {
        if (emailChecked.rows.length === 0) {
          return client.query(SQL, values)
            .then(insertion => {
              req.flash('success_msg', `You've been registerd successfully! Please log into your account.`);
              console.log(insertion.rows);
              res.redirect('/login');
            })
            .catch(() => {
              errorHandler('something went wrong: insertion', req, res);
            });
        } else {
          console.log('Email exists');
          errors.push({ message: "Email already registered" });
          return res.render("register", { LoggedIn: false, err: errors });
        }
      })
      .catch(() => {
        errorHandler('something went wrong: checking email', req, res);
      });

  }
}

function logoutHandler(req, res){
  req.logOut();
  req.log
  res.redirect('/login');
}

function hashPasswords(pass) {
  return bcrypt.hash(pass, 10)
    .then(hashedPass => {
      return hashedPass;
    });
}

function checkAuthenticatied(req,res,next){
  if(req.isAuthenticated()){
    return next();
  }
  res.redirect('/login');
}

function checkNotAuthenticatied(req,res,next){
  if(req.isAuthenticated()){
    return res.redirect('/');
  }
  next();
}


function errorHandler(error, req, res) {
  res.status(500).send(error);
}

function Picture (value){
  this.img_url = value.webformatURL;
  this.photographerName = value.user;
  this.photographerID = value.user_id; 
  this.photographerImg=value.userImageURL;
  this.tags=value.tags.split(', ');
}
function Course (values){
  this.course_img = values.image_480x270;
  this.title = values.title;
  this.course_url = values.url;
  this.disc = values.headline;
  this.inst = values.visible_instructors[0].display_name;
  this.inst_img = values.visible_instructors[0].image_100x100;
  this.inst_url = values.visible_instructors[0].url;

}

client.connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`);
    });
  });
