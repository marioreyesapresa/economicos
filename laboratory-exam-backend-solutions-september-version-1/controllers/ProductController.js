'use strict'
const models = require('../models')
const Product = models.Product
const Order = models.Order
const Restaurant = models.Restaurant
const RestaurantCategory = models.RestaurantCategory
const Sequelize = require('sequelize')
const { validationResult } = require('express-validator')

exports.indexRestaurant = async function (req, res) {
  try {
    const products = await Product.findAll({
      where: {
        restaurantId: req.params.restaurantId
      }
    })
    res.json(products)
  } catch (err) {
    res.status(500).send(err)
  }
}

exports.create = async function (req, res) {
  const err = validationResult(req)

  if (err.errors.length > 0) {
    res.status(422).send(err)
  } else {
    let newProduct = Product.build(req.body)
    if (typeof req.file !== 'undefined') {
      newProduct.image = req.file.path
    }
    try {
      newProduct = await newProduct.save()
      //solucion
      updateRestaurantInexpensiveness(newProduct.restaurantId)
      res.json(newProduct)
    } catch (err) {
      if (err.name.includes('ValidationError')) {
        res.status(422).send(err)
      } else {
        res.status(500).send(err)
      }
    }
  }
}

//solucion
const updateRestaurantInexpensiveness = async function (restaurantId) {
  const queryResultOtherRestaurantsAvgPrice = await Product.findOne({
    where: {
      restaurantId: { [Sequelize.Op.ne]: restaurantId }
    },
    attributes: [
      [Sequelize.fn('AVG', Sequelize.col('price')), 'avgPrice']
    ]
  })
  const queryResultCurrentRestaurantAvgPrice = await Product.findOne({
    where: {
      restaurantId: restaurantId
    },
    attributes: [
      [Sequelize.fn('AVG', Sequelize.col('price')), 'avgPrice']
    ]
  })
  if (queryResultCurrentRestaurantAvgPrice !== null && queryResultOtherRestaurantsAvgPrice !== null) {
    const avgPriceOtherRestaurants = queryResultOtherRestaurantsAvgPrice.dataValues.avgPrice
    const avgPriceCurrentRestaurant = queryResultCurrentRestaurantAvgPrice.dataValues.avgPrice
    const isInexpensive = avgPriceCurrentRestaurant < avgPriceOtherRestaurants
    Restaurant.update({ isInexpensive: isInexpensive }, { where: { id: restaurantId } })
  }
}

exports.update = async function (req, res) {
  const err = validationResult(req)
  if (err.errors.length > 0) {
    res.status(422).send(err)
  } else {
    if (typeof req.file !== 'undefined') {
      req.body.image = req.file.path
    }
    try {
      await Product.update(req.body, { where: { id: req.params.productId } })
      const updatedProduct = await Product.findByPk(req.params.productId)
      res.json(updatedProduct)
    } catch (err) {
      res.status(404).send(err)
    }
  }
}

exports.destroy = async function (req, res) {
  try {
    const result = await Product.destroy({ where: { id: req.params.productId } })
    let message
    if (result === 1) {
      message = 'Sucessfuly deleted product id.' + req.params.productId
    } else {
      message = 'Could not delete product.'
    }
    res.json(message)
  } catch (err) {
    res.status(500).send(err)
  }
}

exports.popular = async function (req, res) {
  try {
    const topProducts = await Product.findAll(
      {
        include: [{
          model: Order,
          as: 'orders',
          attributes: []
        },
        {
          model: Restaurant,
          as: 'restaurant',
          attributes: ['id', 'name', 'description', 'address', 'postalCode', 'url', 'shippingCosts', 'averageServiceMinutes', 'email', 'phone', 'logo', 'heroImage', 'status', 'restaurantCategoryId'],
          include:
        {
          model: RestaurantCategory,
          as: 'restaurantCategory'
        }
        }
        ],
        attributes: {
          include: [
            [Sequelize.fn('SUM', Sequelize.col('orders.OrderProducts.quantity')), 'soldProductCount']
          ],
          separate: true
        },
        group: ['orders.OrderProducts.productId'],
        order: [[Sequelize.col('soldProductCount'), 'DESC']]
      // limit: 3 //this is not supported when M:N associations are involved
      })
    res.json(topProducts.slice(0, 3))
  } catch (err) {
    res.status(500).send(err)
  }
}
