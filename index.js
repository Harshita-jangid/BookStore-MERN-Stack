const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "1234";

const express = require('express')
const app = express()
const port = 3000
const nodemailer = require('nodemailer')
const mongoose = require('mongoose')
const multer = require('multer')
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const Order = require('./models/Order');
app.use(express.static(path.join(__dirname, 'public')));

async function main() {
    await mongoose.connect('mongodb://harshita:MONqsFPNv5jBeuzH@ac-aaevkr3-shard-00-00.an7evvh.mongodb.net:27017,ac-aaevkr3-shard-00-01.an7evvh.mongodb.net:27017,ac-aaevkr3-shard-00-02.an7evvh.mongodb.net:27017/?ssl=true&replicaSet=atlas-gkr78l-shard-0&authSource=admin&appName=Cluster0');
}

main()
.then(()=>{console.log("DB Connected")})
.catch((err)=>{console.log(err)})

const bookschema = new mongoose.Schema({
    Name:String,
    Author:String,
    Price:Number,
    Category:String,
    img:String,
    Description: {
        type: String,
        default: ''
    }
})

const Book = mongoose.model("Book",bookschema)

const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    Name: {
        type: String,
        required: true,
        trim: true
    },
    Email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    Password: {
        type: String,
        required: true
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

function isLoggedIn(req, res, next) {
    if (req.session.userId) {
        return next();
    }

    if (req.method === 'POST' && req.originalUrl.startsWith('/cart/add/')) {
        req.session.pendingBookId = req.params.id;
        req.session.pendingBookQuantity = req.body.quantity || '1';
    }

    req.session.returnTo = '/cart';
    res.redirect('/login');
}

const transport = nodemailer.createTransport({
    service:'gmail',
    auth:{
        user:'cherryblossom59674@gmail.com',
        pass:'cqnd xcki ubqe osli'
    }
 })

 const storage = multer.diskStorage({
    destination:function(req, file, cb){
        cb(null,'public/uploads')
    },
    filename:function(req, file, cb){
        cb(null, Date.now() + '-' + file.originalname)
    }
})
const upload = multer({storage :storage})

app.set('view engine','ejs')
app.use(express.static('public'))
app.use(express.urlencoded({extended:true})) //read form data 

app.use(session({
    secret: 'bookstoresecret',
    resave: false,
    saveUninitialized: false,
}))
app.use(express.urlencoded({ extended: true }))

// app.use((req, res, next) => {
//     res.locals.isAdmin = req.session.isAdmin || false;
//     next();
// });

app.use((req, res, next) => {
    res.locals.isAdmin = !!req.session.isAdmin;
    res.locals.isUserLoggedIn = !!req.session.userId;
    res.locals.currentUserName = req.session.userName || '';
    next();
});
function isAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
}

app.get('/admin/login', (req, res) => {
    res.render('adminlogin.ejs');
})

app.post('/admin/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return req.session.save((err) => {
            if (err) {
                console.error('Admin session error:', err);
                return res.status(500).send('Unable to log in.');
            }
            res.redirect('/books');
        });
    }
    res.status(401).render('adminlogin', {
        error: 'Invalid username or password.'
    });
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
})

app.get('/', async (req, res) => {
    try {
        const books = await Book.find();
        console.log("Total books:", books.length);
        res.render('home', { books });
    } catch (error) {
        console.error("Homepage error:", error);
        res.status(500).send("Unable to load homepage");
    }
});

app.get('/about',(req,res)=>{
    res.render('about')
})
app.post('/books/delete/:id', isAdmin, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).send('Book not found');
        }
        if (book.img && book.img.startsWith('/uploads/')) {
            const imageName = path.basename(book.img);
            const imagePath = path.join(
                __dirname,
                'public',
                'uploads',
                imageName
            );
            try {
                await fs.promises.unlink(imagePath);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
        }
        await Book.findByIdAndDelete(req.params.id);
        res.redirect('/books');
    } catch (error) {
        console.error('Delete book error:', error);
        res.status(500).send('Unable to delete book');
    }
});

app.get('/books/edit/:id',isAdmin, async (req, res) => {
    const Id = req.params.id;
    const book = await Book.findById(Id);
    res.render('editbook', { book });
});

app.post('/books/edit/:id', isAdmin, upload.single('img'), async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);

        if (!book) {
            return res.status(404).send('Book not found');
        }

        book.Name = req.body.Name;
        book.Author = req.body.Author;
        book.Price = Number(req.body.Price);
        book.Category = req.body.Category;
        book.Description = req.body.Description || '';

        if (req.file) {
            const oldImage = book.img;

            if (oldImage && oldImage.startsWith('/uploads/')) {
                const oldPath = path.join(
                    __dirname,
                    'public',
                    'uploads',
                    path.basename(oldImage)
                );

                try {
                    await fs.promises.unlink(oldPath);
                } catch (error) {
                    if (error.code !== 'ENOENT') throw error;
                }
            }

            book.img = '/uploads/' + req.file.filename;
        }

        await book.save();
        res.redirect('/books');
    } catch (error) {
        console.error('Edit book error:', error);
        res.status(500).send('Unable to update book');
    }
});


app.get('/books',async(req,res)=>{
    const books = await Book.find();
    console.log(books)
    res.render('books',{ books })
})
app.get('/books/new', isAdmin,(req,res)=>{
    res.render('newbook')
})

app.get('/books/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).send('Book not found');
        }
        res.render('bookdetails', { book });
    } catch (error) {
        console.error('Book details error:', error);
        res.status(400).send('Invalid book ID');
    }
});

app.post('/books', isAdmin, upload.single('img'), async (req, res) => {
    try {
        const book = new Book({
            Name: req.body.Name,
            Author: req.body.Author,
            Price: Number(req.body.Price),
            Category: req.body.Category,
            Description: req.body.Description || '',
            img: req.file ? '/uploads/' + req.file.filename : ''
        });

        await book.save();
        res.redirect('/books');
    } catch (error) {
        console.error('Add book error:', error);
        res.status(500).send('Unable to add book');
    }
});



app.get('/category',async(req,res)=>{
    const books = await Book.find();
    const categories= [...new Set(books.map(book => book.Category))]; //get unique categories
    res.render('categories',{ books, categories })
})

app.get('/category/:Category',async(req,res)=>{   //automatically get the category from the db 
    const category = req.params.Category;
    const books = await Book.find({Category: category});
    const allBooks = await Book.find();
    const categories = [...new Set(allBooks.map(book => book.Category))];
    res.render('categories', {books,category,categories});
})
app.get('/contact', (req, res) => {
    res.render('contact', {
        success: req.query.success === '1'
    });
});

app.post('/contact', async (req, res) => {
    try {
        const { name, email, mob, message } = req.body;

        await transport.sendMail({
            from: 'cherryblossom59674@gmail.com',
            to: 'cherryblossom59674@gmail.com',
            replyTo: email,
            subject: 'Message from ' + name,
            text: `Name: ${name}\nEmail: ${email}\nMobile: ${mob}\nMessage: ${message}`
        });

        res.send(`
            <script>
                // alert('Your message has been sent successfully!');
                window.location.href = '/contact?success=1';
            </script>
        `);
    } catch (error) {
        console.error('Contact form error:', error);

        res.send(`
            <script>
                alert('Unable to send your message. Please try again.');
                window.location.href = '/contact';
            </script>
        `);
    }
});


app.post('/cart/add/:id', isLoggedIn, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);

        if (!book) {
            return res.status(404).send('Book not found');
        }

        const quantity = Number.parseInt(req.body.quantity || '1', 10);

        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
            return res.status(400).send('Please select a valid quantity.');
        }

        if (!Array.isArray(req.session.cart)) {
            req.session.cart = [];
        }

        const existingBook = req.session.cart.find(
            item => item.bookId === book._id.toString()
        );

        if (existingBook) {
            if (existingBook.quantity + quantity > 99) {
                return res.status(400).send('Maximum quantity is 99.');
            }

            existingBook.quantity += quantity;
        } else {
            req.session.cart.push({
                bookId: book._id.toString(),
                Name: book.Name,
                Author: book.Author,
                Price: Number(book.Price),
                img: book.img,
                quantity
            });
        }

        res.redirect('/cart');
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).send('Unable to add book to cart');
    }
});
app.get('/cart',isLoggedIn,(req, res) => {
    const cart = req.session.cart || [];
    const total = cart.reduce(
        (sum, item) => sum + item.Price * item.quantity,
        0
    );
    res.render('cart', { cart, total });
});

app.post('/cart/remove/:id',isLoggedIn, (req, res) => {
    const cart = req.session.cart || [];
    req.session.cart = cart.filter(
        item => item.bookId !== req.params.id
    );
    res.redirect('/cart');
});

app.post('/cart/update/:id',isLoggedIn, (req, res) => {
    const cart = req.session.cart || [];
    const quantity = Number.parseInt(req.body.quantity, 10);
    const item = cart.find(
        book => book.bookId === req.params.id
    );
    if (item && Number.isInteger(quantity) && quantity >= 1) {
        item.quantity = quantity;
    }
    res.redirect('/cart');
});

async function startUserSession(req, res, user, redirectTo = '/books') {
    try {
        const wasAdmin = !!req.session.isAdmin;
        const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
        const pendingBookId = req.session.pendingBookId;
        const pendingBookQuantity = Number.parseInt(
        req.session.pendingBookQuantity || '1',
        10
        );   
        if (pendingBookId) {
            const book = await Book.findById(pendingBookId);

            if (book) {
                const existingBook = cart.find(
                    item => item.bookId === book._id.toString()
                );

                if (existingBook) {
                    existingBook.quantity += 1;
                } else {
                    cart.push({
                        bookId: book._id.toString(),
                        Name: book.Name,
                        Author: book.Author,
                        Price: Number(book.Price),
                        img: book.img,
                        quantity: 1
                    });
                }

                redirectTo = '/cart';
            }
        }

        req.session.regenerate((err) => {
            if (err) {
                console.error('Session error:', err);
                return res.status(500).send('Unable to start session.');
            }

            req.session.isAdmin = wasAdmin;
            req.session.cart = cart;
            req.session.userId = user._id.toString();
            req.session.userName = user.Name;

            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('Session save error:', saveErr);
                    return res.status(500).send('Unable to save session.');
                }

                res.redirect(redirectTo);
            });
        });
    } catch (error) {
        console.error('User session error:', error);
        res.status(500).send('Unable to complete login.');
    }
}

app.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/books');
    }

    res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
    try {
        const Name = req.body.Name?.trim();
        const Email = req.body.Email?.trim().toLowerCase();
        const Password = req.body.Password;
        if (!Name || !Email || !Password) {
            return res.status(400).render('register', {
                error: 'Please fill in all fields.'
            });
        }
        if (Name.length > 100 || Email.length > 254 || Password.length < 8) {
            return res.status(400).render('register', {
                error: 'Enter valid details. Password must be at least 8 characters.'
            });
        }
        const existingUser = await User.findOne({ Email });
        if (existingUser) {
            return res.status(409).render('register', {
                error: 'Email is already registered. Please log in.'
            });
        }
        const hashedPassword = await bcrypt.hash(Password, 12);
        const user = await User.create({
            Name,
            Email,
            Password: hashedPassword
        });
        await startUserSession(req, res, user, '/books');
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 11000) {
            return res.status(409).render('register', {
                error: 'Email is already registered. Please log in.'
            });
        }
        res.status(500).render('register', {
            error: 'Unable to create account. Please try again.'
        });
    }
});

app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/books');
    }
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    try {
        const Email = req.body.Email?.trim().toLowerCase();
        const Password = req.body.Password;
        if (!Email || !Password) {
            return res.status(400).render('login', {
                error: 'Enter your email and password.'
            });
        }
        const user = await User.findOne({ Email });
        if (!user || !(await bcrypt.compare(Password, user.Password))) {
            return res.status(401).render('login', {
                error: 'Invalid email or password.'
            });
        }
        const pendingBookId = req.session.pendingBookId;
        const returnTo = req.session.returnTo;
        let redirectTo = '/books';
        if (pendingBookId) {
            redirectTo = '/cart';
        } else if (
            typeof returnTo === 'string' &&
            returnTo.startsWith('/') &&
            !returnTo.startsWith('//')
        ) {
            redirectTo = returnTo;
        }
        await startUserSession(req, res, user, redirectTo);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).render('login', {
            error: 'Unable to log in. Please try again.'
        });
    }
});

app.post('/logout', (req, res) => {
    delete req.session.userId;
    delete req.session.userName;
    delete req.session.pendingBookId;
    delete req.session.pendingBookQuantity;
    delete req.session.returnTo;

    req.session.save((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send('Unable to log out.');
        }

        res.redirect('/');
    });
});


app.get('/checkout', isLoggedIn, (req, res) => {
    const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
    if (!cart.length) return res.redirect('/cart');

    const total = cart.reduce((sum, item) => sum + Number(item.Price) * Number(item.quantity), 0);
    res.render('checkout', { cart, total, error: '', formData: {}, currentUserName: req.session.userName || '' });
});

app.post('/checkout', isLoggedIn, async (req, res) => {
    const formData = {
        customerName: String(req.body.customerName || '').trim(),
        phone: String(req.body.phone || '').trim(),
        address: String(req.body.address || '').trim(),
        city: String(req.body.city || '').trim(),
        pincode: String(req.body.pincode || '').trim()
    };

    const renderCheckout = (error) => {
        const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
        const total = cart.reduce((sum, item) => sum + Number(item.Price) * Number(item.quantity), 0);
        return res.status(400).render('checkout', { cart, total, error, formData, currentUserName: req.session.userName || '' });
    };

    if (!formData.customerName || !/^[6-9]\d{9}$/.test(formData.phone) || !formData.address || !formData.city || !/^[1-9]\d{5}$/.test(formData.pincode)) {
        return renderCheckout('Please enter valid delivery details.');
    }

    if (req.body.paymentMethod !== 'COD') return renderCheckout('Please select a valid payment method.');

    const cart = Array.isArray(req.session.cart) ? req.session.cart : [];
    if (!cart.length) return res.redirect('/cart');

    try {
        const orderItems = [];
        let totalAmount = 0;

        for (const item of cart) {
            const quantity = Number(item.quantity);
            if (!mongoose.isValidObjectId(item.bookId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
                return renderCheckout('Your cart contains an invalid item. Please review your cart.');
            }

            const book = await Book.findById(item.bookId);
            if (!book || !Number.isFinite(Number(book.Price)) || Number(book.Price) < 0) {
                return renderCheckout('A book in your cart is no longer available. Please review your cart.');
            }

            const price = Number(book.Price);
            totalAmount += price * quantity;
            orderItems.push({ bookId: book._id.toString(), name: book.Name, author: book.Author || 'Unknown Author', price, quantity, img: book.img || '' });
        }

        totalAmount = Math.round((totalAmount + Number.EPSILON) * 100) / 100;
        const order = await Order.create({ userId: req.session.userId, ...formData, items: orderItems, totalAmount, paymentMethod: 'COD', paymentStatus: 'Pending', orderStatus: 'Placed' });
        req.session.cart = [];

        req.session.save((err) => {
            if (err) {
                console.error('Cart session save error:', err);
                return res.status(500).send('Your order was saved, but the session could not be updated. Please check your orders before retrying.');
            }
            res.redirect('/order-success/' + order._id);
        });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).send('Unable to place your order right now. Please try again later.');
    }
});

app.get('/order-success/:id', isLoggedIn, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Order not found.');

        const order = await Order.findOne({ _id: req.params.id, userId: req.session.userId });
        if (!order) return res.status(404).send('Order not found.');

        res.render('order-success', { order });
    } catch (error) {
        console.error('Order confirmation error:', error);
        res.status(500).send('Unable to display your order.');
    }
});


app.get('/admin/orders', isAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.render('admin-orders', { orders });
    } catch (error) {
        console.error('Orders fetch error:', error);
        res.status(500).send('Unable to load orders.');
    }
});

app.post('/admin/orders/:id/status', isAdmin, async (req, res) => {
    try {
        const allowedStatuses = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        const status = req.body.orderStatus;

        if (!mongoose.isValidObjectId(req.params.id) || !allowedStatuses.includes(status)) {
            return res.status(400).send('Invalid order or status.');
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { orderStatus: status },
            { new: true, runValidators: true }
        );

        if (!order) return res.status(404).send('Order not found.');

        res.redirect('/admin/orders');
    } catch (error) {
        console.error('Order update error:', error);
        res.status(500).send('Unable to update order status.');
    }
});

app.listen(port,()=>{
    console.log("Listening on "+port)
})