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
const natgeo = require('national-geographic-api').NationalGeographicAPI;

const client = new pg.Client(process.env.DATABASE_URL);



const initializePassport = require('./passport-config');
initializePassport(passport,
  (email) => {
    return client.query('SELECT * FROM users WHERE email = $1', [email])
      .then(result => {
        if (result.rows.length !== 0) {
          return result.rows[0];
        }
        else {
          return null;
        }
      });
  },
  (id) => {
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
app.post("/users/login", checkNotAuthenticatied, passport.authenticate("local", {
  successRedirect: "/dashboard",
  failureRedirect: "/login",
  failureFlash: true
}));
app.post('/imgSearches', imagesSearchHandler);
app.get('/courses', coursesHandler);
app.post('/addToFavorite', checkAuthenticatied, addToFavoriteHandler);
app.get('/favorite', checkAuthenticatied, displayFavoriteHandler);
app.delete('/removeFromFavorite', checkAuthenticatied, removeFromFavoriteHandler);
app.get('/books', bokosHandler);
app.get('/favorite/filter',checkAuthenticatied,favouriteHandler);
function favouriteHandler (req,res){
  let SQL = `SELECT * FROM images WHERE image_type=$1 and id IN (SELECT img_id FROM favourite WHERE user_id = $2)`
  client.query(SQL,[req.body.type,req.user.id])
  .then((data)=> {
    res.render('userFavorite', { LoggedIn: true, favs: data.rows, user: req.user });
  })
  .catch(e => {
    res.send(e);
  });
}


function addToFavoriteHandler(req, res) {

  let { img_url, photographer_name, photographer_id, photographer_img_url, image_type } = req.body;
  let x = [img_url, photographer_name, photographer_id, photographer_img_url, image_type]

  let SQL = `SELECT * FROM images WHERE img_url=$1;`

  client.query(SQL, [img_url])
    .then((data) => {
      if (data.rows.length !== 0) {
        let SQL2 = `INSERT INTO favourite (user_id, img_id) VALUES ($1, $2)  ON CONFLICT (user_id, img_id) DO NOTHING;`

        client.query(SQL2, [req.user.id, data.rows[0].id])
          .then(() => {
            res.redirect('/favorite');
          })
      } else {
        let newSQL = `INSERT INTO images (img_url, photographer_name, photographer_id, photographer_img_url, image_type) VALUES ($1, $2, $3, $4, $5) RETURNING *;`
        client.query(newSQL, [img_url, photographer_name, photographer_id, photographer_img_url, image_type])
          .then((results) => {
            let SQL2 = `INSERT INTO favourite (user_id, img_id) VALUES ($1, $2) ON CONFLICT (user_id, img_id) DO NOTHING;`
            client.query(SQL2, [req.user.id, results.rows[0].id])
              .then(() => {
                res.redirect('/favorite');
              })
          })
      }
    })

}

function displayFavoriteHandler(req, res) {
  let SQL = 'SELECT * FROM images WHERE id IN (SELECT img_id FROM favourite WHERE user_id = $1)';
  client.query(SQL, [req.user.id])
    .then((data) => {
      console.log(data.rows);
      res.render('userFavorite', { LoggedIn: true, favs: data.rows, user: req.user });
    })
    .catch(e => {
      res.send(e);
    });
}


function removeFromFavoriteHandler(req, res) {
  let SQL = 'DELETE FROM favourite WHERE user_id =$1 and img_id = $2';
  client.query(SQL, [req.user.id, req.body.image_id])
    .then(() => {
      res.redirect('/favorite');
    })
    .catch(e => {
      res.send(e);
    });
}

async function homeHandler(req, res) {
  let pictureOfTheDay = await natgeo.getPhotoOfDay(`DAY` , `CALLBACK`)
  .then((result) => {
    return result.data[0].attributes;
  });
  let potd = new PictureOfTheDay(pictureOfTheDay); 
  console.log(potd);
  if (req.user) {
    res.render('index', { LoggedIn: true, user: req.user, pictureOfTheDay: potd})
  }
  else {
    res.render('index', { LoggedIn: false, pictureOfTheDay: potd })
  }
}
function coursesHandler(req, res) {
  let URL = `https://www.udemy.com/api-2.0/courses/?category=Photography+%26+Video&page=1&page_size=12&price=price-free`;
  superagent(URL)
    .set('Authorization', `Basic ${Buffer.from(`${process.env.UDEMEM_CLIENT}:${process.env.UDEMEY_SECRET}`).toString('base64')}`)
    .then(result => {
      let courses = result.body.results.map(val => {
        return new Course(val);

      });
      if (req.user) {
        res.render('courses', { LoggedIn: true, courses: courses, user: req.user })
      }
      else {
        res.status(200).render('courses', { LoggedIn: false, courses: courses });
      }
    }).catch((e) => {
      res.status(500).send(e);
    });
}

function registerUserHandler(req, res) {
  if (req.user) {
    res.render('register', { LoggedIn: true, name: req.user })
  }
  else {
    res.render('register', { LoggedIn: false });
  }
}

function loginUserHandler(req, res) {
  if (req.user) {
    res.render('login', { LoggedIn: true, name: req.user })
  }
  else {
    res.render('login', { LoggedIn: false });
  }
}

function dashboardHandler(req, res) {
  if (req.user) {
    res.render('dashboard', { LoggedIn: true, user: req.user })
  }
  else {
    res.render('dashboard', { LoggedIn: false });
  }
}

async function registerUserInDBHandler(req, res) {
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
              res.redirect('/login');
            })
            .catch(() => {
              errorHandler('something went wrong: insertion', req, res);
            });
        } else {
          errors.push({ message: "Email already registered" });
          return res.render("register", { LoggedIn: false, err: errors });
        }
      })
      .catch(() => {
        errorHandler('something went wrong: checking email', req, res);
      });

  }
}

function bokosHandler(req, res) {
  let url = `https://www.googleapis.com/books/v1/volumes?q=Photography`
  superagent(url)
    .then((data) => {
      let books = data.body.items.map(book => {
        return new Book(book);
      })
      if (req.user) {
        res.render('books', { LoggedIn: true, books: books, user: req.user })
      }
      else {
        res.status(200).render('books', { LoggedIn: false, books: books });
      }
    }).catch((e) => {
      res.status(500).send(e);
    })
}

function imagesSearchHandler(req, res) {
  let key = process.env.PIXABAY;
  let picSearch = req.body.search_query;

  let URL = `https://pixabay.com/api/?key=${key}&q=${picSearch}`;
  if (req.body.color !== 'none') {
    URL += `&colors=${req.body.color}`
  }
  if (req.body.category !== 'none') {
    URL += `&category=${req.body.category}`
  }
  if (req.body.type !== 'none') {
    URL += `&image_type=${req.body.type}`
  }
  superagent(URL)

    .then(imgs => {

      let picturs = imgs.body.hits.map(img => {
        return new Picture(img)
      });
      if (req.user) {
        res.render('searchResults', { LoggedIn: true, imgs: picturs, user: req.user });
      }
      else {
        res.render('searchResults', { imgs: picturs, LoggedIn: false });
      }
    });
}

function logoutHandler(req, res) {
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

function checkAuthenticatied(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

function checkNotAuthenticatied(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/');
  }
  next();
}

function errorHandler(error, req, res) {
  res.status(500).send(error);
}

function Picture(value) {
  this.img_url = value.webformatURL;
  this.photographerName = value.user;
  this.photographerID = value.user_id;
  this.photographerImg = value.userImageURL;
  this.tags = value.tags.split(', ');
  this.imgType = value.type;
}

function Course(values) {
  this.course_img = values.image_480x270;
  this.title = values.title;
  this.course_url = values.url;
  this.disc = values.headline;
  this.inst = values.visible_instructors[0].display_name;
  this.inst_img = values.visible_instructors[0].image_100x100;
  this.inst_url = values.visible_instructors[0].url;

}

function Book(book) {
  this.title = book.volumeInfo.title;
  this.image = book.volumeInfo.imageLinks ? book.volumeInfo.imageLinks.smallThumbnail : `https://i.imgur.com/J5LVHEL.jpg`;
  this.authors = book.volumeInfo.authors ? book.volumeInfo.authors[0] : 'Not avilabile';
  this.description = book.volumeInfo.description ? book.volumeInfo.description : 'Not avilabile';
  this.link = book.volumeInfo.infoLink;
}

function PictureOfTheDay(data){
  this.url = data.image.uri;
  this.title = data.image.title;
  this.caption = data.image.caption;
  this.credit= data.image.credit;
  this.date = `${new Date().toLocaleString('default', { month: 'long'})} ${new Date().getDate()}, ${new Date().getFullYear()}`;
}

client.connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`);
    });
  });
