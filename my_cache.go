package cache

import (
	"container/list"
	"errors"
	"log"
	"sync"
)

type CacheItem struct {
	key   string
	value interface{}
}

type LRUCache struct {
	capacity int
	cache    map[string]*list.Element
	list     *list.List
	mutex    sync.Mutex
}

func NewLRUCache(capacity int) *LRUCache {
	return &LRUCache{
		capacity: capacity,
		cache:    make(map[string]*list.Element),
		list:     list.New(),
	}
}

func (c *LRUCache) Get(key string) (interface{}, error) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if elem, ok := c.cache[key]; ok {
		c.list.MoveToFront(elem)
		return elem.Value.(*CacheItem).value, nil
	}
	return nil, errors.New("value is not a number")
}

func (c *LRUCache) Put(key string, value interface{}) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if elem, ok := c.cache[key]; ok {
		c.list.MoveToFront(elem)
		elem.Value.(*CacheItem).value = value
		return
	}

	if c.list.Len() >= c.capacity {
		backElem := c.list.Back()
		if backElem != nil {
			c.list.Remove(backElem)
			delete(c.cache, backElem.Value.(*CacheItem).key)
		}
	}

	item := &CacheItem{key, value}
	elem := c.list.PushFront(item)
	c.cache[key] = elem
}

func (c *LRUCache) Increment(key string, delta int64) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	elem, ok := c.cache[key]
	if !ok {
		return errors.New("key not found")
	}

	cacheItem := elem.Value.(*CacheItem)
	switch v := cacheItem.value.(type) {
	case int:
		cacheItem.value = v + int(delta)
	case int64:
		cacheItem.value = v + delta
	case float64:
		cacheItem.value = v + float64(delta)
	default:
		return errors.New("value is not a number")
	}

	c.list.MoveToFront(elem)
	return nil
}

func (c *LRUCache) Decrement(key string, delta int64) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	elem, ok := c.cache[key]
	if !ok {
		return errors.New("key not found")
	}

	cacheItem := elem.Value.(*CacheItem)
	switch v := cacheItem.value.(type) {
	case int:
		cacheItem.value = v - int(delta)
	case int64:
		cacheItem.value = v - delta
	case float64:
		cacheItem.value = v - float64(delta)
	default:
		return errors.New("value is not a number")
	}

	c.list.MoveToFront(elem)
	return nil
}

func (c *LRUCache) StoreUserAndPasswordKeys(username, password string) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	log.Printf("Authenticating user='%s' with password='%s'\n", username, password)
	c.Put(username, password)
	return nil
}
