DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS favourite;
DROP TABLE IF EXISTS images;

CREATE TABLE IF NOT EXISTS users(
id SERIAl PRIMARY KEY,
name VARCHAR(255) NOT NULL,
email VARCHAR(255) NOT NULL UNIQUE,
password VARCHAR(255) NOT NULL
);

CREATE TABLE IF  NOT EXISTS images(
    id SERIAl PRIMARY KEY,
    img_url VARCHAR(255) NOT NULL UNIQUE,
    photographer_name VARCHAR(255),
    photographer_id INT,
    photographer_img_url VARCHAR(255),
    image_type VARCHAR(255)
);

CREATE TABLE IF  NOT EXISTS favourite(
user_id INT references users(id),
img_id INT references images(id),
PRIMARY KEY (user_id,img_id)
);
